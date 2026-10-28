import { unstable_rethrow } from "next/navigation";
import { cache } from "react";
import { driveAccessToken, serviceAccount } from "./google";
import { GOOGLE_DOC_MIME, KIND_ORDER, detectKind, detectLinkKind, fold, parseTitle, partName, splitExt } from "./kinds";
import type { LinkKind, Song, TabFile } from "./types";

/** How often (seconds) the site re-reads the Drive folder. */
export const REVALIDATE_SECONDS = 300;

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const MAX_DEPTH = 6;

/**
 * The root Drive folders: DRIVE_FOLDER_ID holds one or more, separated by commas (folders owned by different
 * people, each shared with the service account). A folder's ID or its whole URL both work. Throws a readable
 * error when the site isn't configured yet.
 */
function rootFolders(): string[] {
  const folders = (process.env.DRIVE_FOLDER_ID ?? "")
    .split(/[,;\s]+/)
    .map((s) => /\/folders\/([\w-]+)/.exec(s)?.[1] ?? s.replace(/["']/g, ""))
    .filter(Boolean);
  if (!folders.length || !serviceAccount()) {
    throw new Error("Chưa cấu hình Google Drive (DRIVE_FOLDER_ID và GOOGLE_SERVICE_ACCOUNT_JSON).");
  }
  return [...new Set(folders)];
}

interface Entry {
  id: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
  size: number | null;
  modifiedTime: string | null;
}

/** Walks a folder tree, keeping only sheet/tab files and link files (see detectLinkKind). */
async function walkTree(rootId: string) {
  const out: (TabFile & { link?: LinkKind })[] = [];
  async function walk(folderId: string, folder: string[], parentId: string | null) {
    const entries = await driveChildren(folderId);
    await Promise.all(
      entries.map(async (e) => {
        if (e.isFolder) {
          if (folder.length < MAX_DEPTH) await walk(e.id, [...folder, e.name], e.id);
          return;
        }
        const isGoogleFile = e.mimeType.startsWith("application/vnd.google-apps.");
        const ext = isGoogleFile ? "" : splitExt(e.name)[1];
        const link = detectLinkKind(e.name, ext, e.mimeType);
        const kind = link ? "text" : detectKind(ext, e.mimeType);
        if (!kind) return; // audio, video clips, other documents
        out.push({
          ...(link && { link }),
          id: e.id,
          name: e.name,
          folder,
          parentId,
          ext,
          mimeType: e.mimeType,
          kind,
          size: e.size,
          modifiedTime: e.modifiedTime,
        });
      }),
    );
  }
  await walk(rootId, [], null);
  return out;
}

// ---------- Google Drive (private folder, read with a service account) ----------

async function driveFetch(url: string) {
  const token = await driveAccessToken();
  return fetch(url, { cache: "no-store", headers: { authorization: `Bearer ${token}` } });
}

/**
 * Drive answers kept in memory for REVALIDATE_SECONDS, per server process (or Cloudflare Worker isolate).
 * Plain memory rather than Next's fetch cache, which on Cloudflare would need an extra storage bucket.
 */
const memo = new Map<string, { expires: number; value: Promise<unknown> }>();
function remember<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as Promise<T>;
  const value = load();
  memo.set(key, { expires: Date.now() + REVALIDATE_SECONDS * 1000, value });
  value.catch(() => memo.delete(key)); // don't keep a failure around
  return value;
}

function driveChildren(folderId: string): Promise<Entry[]> {
  return remember(`children:${folderId}`, () => loadChildren(folderId));
}

async function loadChildren(folderId: string): Promise<Entry[]> {
  const entries: Entry[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q: `'${folderId.replace(/'/g, "")}' in parents and trashed = false`,
      fields: "nextPageToken,files(id,name,mimeType,size,modifiedTime)",
      pageSize: "1000",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await driveFetch(`${DRIVE_API}/files?${params}`);
    if (!res.ok) {
      const body = await res.text();
      let message = body;
      try {
        message = (JSON.parse(body) as { error?: { message?: string } }).error?.message ?? body;
      } catch {}
      throw new Error(`Google Drive API trả về lỗi ${res.status}: ${message}`);
    }
    const data = (await res.json()) as {
      files: { id: string; name: string; mimeType: string; size?: string; modifiedTime?: string }[];
      nextPageToken?: string;
    };
    for (const f of data.files) {
      entries.push({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        isFolder: f.mimeType === FOLDER_MIME,
        size: f.size ? Number(f.size) : null,
        modifiedTime: f.modifiedTime ?? null,
      });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return entries;
}

// ---------- Songs ----------

const collator = new Intl.Collator("vi", { sensitivity: "base", numeric: true });

/**
 * One file per part ("Intro", "Solo", the whole song…): files named for the same part hold the same sheet
 * in different formats, so only the lightest to serve is kept. Pictures come last (stamping one decodes the
 * whole image, ~150 MB for a long sheet); otherwise the smallest file wins.
 */
function onePerPart(song: Song) {
  const cost = (f: TabFile) => [f.kind === "image" ? 1 : 0, f.size ?? 0];
  const best = new Map<string, TabFile>();
  for (const f of song.files) {
    const key = fold(partName(f, song.title));
    const kept = best.get(key);
    if (!kept) {
      best.set(key, f);
      continue;
    }
    const [a, b] = [cost(f), cost(kept)];
    if (a[0] < b[0] || (a[0] === b[0] && a[1] < b[1])) best.set(key, f);
  }
  song.files = [...best.values()];
}

function groupSongs(files: (TabFile & { link?: LinkKind })[]): Song[] {
  const songs = new Map<string, Song>();
  for (const { link, ...f } of files) {
    const id = f.parentId ?? f.id;
    let song = songs.get(id);
    if (!song) {
      const own = parseTitle(f.ext ? splitExt(f.name)[0] : f.name);
      song = f.parentId
        ? { id, ...parseTitle(f.folder[f.folder.length - 1]), category: f.folder.slice(0, -1), files: [], links: {}, modifiedTime: null }
        : { id, ...own, category: [], files: [], links: {}, modifiedTime: null };
      songs.set(id, song);
    }
    if (link) {
      song.links[link] ??= f;
      continue;
    }
    song.files.push(f);
    if (f.modifiedTime && (!song.modifiedTime || f.modifiedTime > song.modifiedTime)) song.modifiedTime = f.modifiedTime;
  }
  for (const song of songs.values()) {
    onePerPart(song);
    song.files.sort(
      (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || collator.compare(a.name, b.name),
    );
  }
  // A folder holding only link files has nothing to show.
  return [...songs.values()].filter((s) => s.files.length > 0).sort((a, b) => collator.compare(a.title, b.title));
}

// ---------- Public API ----------

export const listSongs = cache(async (): Promise<{ songs: Song[]; error: string | null }> => {
  try {
    // Every root folder's songs together; "Solo" / "Melody" of different owners merge into one section.
    // One folder failing (not shared yet, deleted…) leaves the others' songs on the site.
    const roots = rootFolders();
    const results = await Promise.allSettled(roots.map((id) => walkTree(id)));
    const files = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    const failed = results.flatMap((r, i) => (r.status === "rejected" ? [{ id: roots[i], reason: r.reason }] : []));
    for (const f of failed) unstable_rethrow(f.reason);
    if (failed.length === roots.length) throw failed[0].reason;
    for (const f of failed) console.error("Drive folder", f.id, f.reason);
    const error = failed.length
      ? `Không đọc được ${failed.length}/${roots.length} thư mục Drive (chưa chia sẻ cho tài khoản dịch vụ?): ${failed.map((f) => f.id).join(", ")}`
      : null;
    return { songs: groupSongs(files), error };
  } catch (err) {
    unstable_rethrow(err); // let Next.js's own render signals through
    console.error(err);
    return { songs: [], error: err instanceof Error ? err.message : String(err) };
  }
});

export async function getSong(id: string): Promise<Song | null> {
  const { songs } = await listSongs();
  return songs.find((s) => s.id === id) ?? null;
}

export async function getTab(id: string): Promise<TabFile | null> {
  const { songs } = await listSongs();
  for (const s of songs) {
    const f = s.files.find((t) => t.id === id);
    if (f) return f;
  }
  return null;
}

function driveContentUrl(tab: TabFile) {
  return tab.mimeType === GOOGLE_DOC_MIME
    ? `${DRIVE_API}/files/${tab.id}/export?mimeType=text/plain`
    : `${DRIVE_API}/files/${tab.id}?alt=media&supportsAllDrives=true`;
}

/** Whole file contents. Sheet/tab files are small, so they're read into memory. */
export async function getTabBytes(tab: TabFile): Promise<Uint8Array> {
  const res = await driveFetch(driveContentUrl(tab));
  if (!res.ok) throw new Error(`Không tải được file từ Google Drive (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Text contents for text tabs. Handles UTF-8, UTF-16 and legacy Vietnamese Windows-1258 files. */
export async function getTabText(tab: TabFile): Promise<string> {
  const bytes = await getTabBytes(tab);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, "");
  } catch {
    try {
      return new TextDecoder("windows-1258").decode(bytes).normalize("NFC");
    } catch {
      return new TextDecoder("utf-8").decode(bytes);
    }
  }
}

/**
 * The link in a link file (video.txt, backing.txt, a .url shortcut…): its first http(s) address, or null.
 * Cached like the folder listing, so a song page doesn't hit Drive on every view.
 */
export function getLinkUrl(file: TabFile): Promise<string | null> {
  return remember(`link:${file.id}:${file.modifiedTime}`, async () => {
    try {
      const res = await driveFetch(driveContentUrl(file));
      if (!res.ok) return null;
      const match = /https?:\/\/[^\s"'<>]+/i.exec(await res.text());
      return match ? new URL(match[0]).toString() : null;
    } catch {
      return null;
    }
  });
}
