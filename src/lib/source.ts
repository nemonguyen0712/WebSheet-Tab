import { unstable_rethrow } from "next/navigation";
import { cache } from "react";
import { type DriveFolder, type Section, listDriveFolders } from "./drive-folders";
import { driveAccessToken, serviceAccount } from "./google";
import { GOOGLE_DOC_MIME, KIND_ORDER, detectKind, detectLinkKind, fold, parseTitle, partName, splitExt } from "./kinds";
import type { LinkKind, Song, TabFile } from "./types";

/** How often (seconds) the site re-reads the Drive folder. */
export const REVALIDATE_SECONDS = 300;

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const MAX_DEPTH = 6;

/**
 * The root Drive folders (see lib/drive-folders.ts: the environment's plus those added in /admin), each shared
 * with the service account, possibly owned by different people. Throws a readable error when there are none.
 */
async function rootFolders(): Promise<DriveFolder[]> {
  const { folders } = await listDriveFolders();
  if (!folders.length || !serviceAccount()) {
    throw new Error("Chưa cấu hình Google Drive (thêm thư mục trong /admin, và GOOGLE_SERVICE_ACCOUNT_JSON).");
  }
  return folders;
}

/**
 * The site's two sections, under the names the original Drive folders use. Folders of other owners are
 * filed under these whatever their own spelling ("Solo", "Bài solo", "Mel"…), so they share /solo and /melody.
 */
export const SECTION_NAME: Record<Section, string> = { solo: "SOLO", melody: "MELODY" };

/** "SOLO", "Bài solo", "Solos" → solo; "Melody", "MEL", "giai điệu (melody)" → melody; anything else → null. */
export function sectionOf(folderName: string): Section | null {
  const f = fold(folderName);
  if (/\bsolos?\b/.test(f)) return "solo";
  if (/\bmel(ody|odies)?\b/.test(f)) return "melody";
  return null;
}

// ---------- Cloudflare KV Cache ----------

interface KVNamespace {
  get(key: string, type: "json"): Promise<unknown>;
  get(key: string, type?: "text"): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

async function kvBinding(): Promise<KVNamespace | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    return (getCloudflareContext().env as { CACHE?: KVNamespace }).CACHE ?? null;
  } catch {
    return null;
  }
}

const SONGS_CACHE_KEY = "oliu:songs:v2";
/** Keep songs cached in KV for 24 hours. Admin can force re-sync at any time. */
const SONGS_CACHE_TTL = 86400;

export async function clearSongsCache(): Promise<void> {
  memo.clear();
  const kv = await kvBinding();
  if (kv) {
    try {
      await kv.delete(SONGS_CACHE_KEY);
      await kv.delete("oliu:songs:v1");
    } catch (e) {
      console.error("Lỗi xóa KV cache:", e);
    }
  }
}

/** For /admin: how many songs one root folder holds and in which sections, or why it can't be read. */
export async function checkDriveFolder(
  id: string,
  section: Section | null,
  options?: { live?: boolean },
): Promise<{ songs: number; sections: [string, number][] } | { error: string }> {
  const kv = await kvBinding();
  const key = `oliu:folder:${id}:v2`;

  // On page loads in /admin: read cached summary from KV in 1ms instead of crawling Drive!
  if (!options?.live && kv) {
    try {
      const cached = (await kv.get(key, "json")) as { songs: number; sections: [string, number][] } | null;
      if (cached && typeof cached.songs === "number") return cached;
    } catch {}
  }

  // Only crawl Google Drive if live check requested (e.g. adding a folder in /admin)
  if (!options?.live) {
    return { songs: 0, sections: [] };
  }

  try {
    const songs = groupSongs(await walkTree(id, section));
    const bySection = new Map<string, number>();
    for (const s of songs) bySection.set(s.category[0] ?? "", (bySection.get(s.category[0] ?? "") ?? 0) + 1);
    const res = { songs: songs.length, sections: [...bySection] };
    if (kv) {
      try {
        await kv.put(key, JSON.stringify(res), { expirationTtl: SONGS_CACHE_TTL });
      } catch {}
    }
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: /\b40[34]\b/.test(message) ? "Không đọc được: thư mục chưa chia sẻ cho tài khoản dịch vụ, hoặc link sai." : message };
  }
}

/** The email Drive folders must be shared with (Viewer). */
export function serviceAccountEmail(): string | null {
  return serviceAccount()?.client_email ?? null;
}

interface Entry {
  id: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
  size: number | null;
  modifiedTime: string | null;
}

/**
 * Walks a folder tree, keeping only sheet/tab files and link files (see detectLinkKind). `section`: the whole
 * root is that section, its subfolders being songs; null: the root's own subfolders are the sections, and
 * those named after Solo / Melody are filed under SECTION_NAME.
 */
async function walkTree(rootId: string, section: Section | null = null) {
  const out: (TabFile & { link?: LinkKind })[] = [];
  async function walk(folderId: string, folder: string[], parentId: string | null) {
    const entries = await driveChildren(folderId);
    // Process sequentially so Cloudflare Workers doesn't exceed simultaneous outgoing sockets
    for (const e of entries) {
      if (e.isFolder) {
        const atTop = !section && folder.length === 0;
        const top = atTop ? sectionOf(e.name) : null;
        const name = top ? SECTION_NAME[top] : e.name;
        if (folder.length < MAX_DEPTH) await walk(e.id, [...folder, name], e.id);
        continue;
      }
      const isGoogleFile = e.mimeType.startsWith("application/vnd.google-apps.");
      const ext = isGoogleFile ? "" : splitExt(e.name)[1];
      const link = detectLinkKind(e.name, ext, e.mimeType);
      const kind = link ? "text" : detectKind(ext, e.mimeType);
      if (!kind) continue; // audio, video clips, other documents
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
    }
  }
  await walk(rootId, section ? [SECTION_NAME[section]] : [], null);
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
        : { id, ...own, category: f.folder, files: [], links: {}, modifiedTime: null };
      songs.set(id, song);
    }
    if (link) {
      song.links[link] ??= f;
      continue;
    }
    if (f.kind === "audio") {
      song.audios ??= [];
      song.audios.push(f);
      // Prefer mp3 over wav/other formats as the primary playback audio
      if (!song.audio || (f.ext === "mp3" && song.audio.ext !== "mp3")) {
        song.audio = f;
      }
      if (f.modifiedTime && (!song.modifiedTime || f.modifiedTime > song.modifiedTime)) song.modifiedTime = f.modifiedTime;
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
  // A folder holding sheet files or audio files can be shown.
  return [...songs.values()].filter((s) => s.files.length > 0 || Boolean(s.audio)).sort((a, b) => collator.compare(a.title, b.title));
}

async function fetchSongsFromDrive(): Promise<{ songs: Song[]; error: string | null }> {
  // Every root folder's songs together; "Solo" / "Melody" of different owners merge into one section.
  const roots = await rootFolders();
  const results: PromiseSettledResult<(TabFile & { link?: LinkKind })[]>[] = [];
  const kv = await kvBinding();

  // Walk root folders sequentially so they don't fight for Cloudflare's outgoing connections
  for (const r of roots) {
    try {
      const files = await walkTree(r.id, r.section);
      results.push({ status: "fulfilled", value: files });
      // Cache folder summary so /admin loads instantly without hitting Drive!
      if (kv) {
        const folderSongs = groupSongs(files);
        const bySection = new Map<string, number>();
        for (const s of folderSongs) bySection.set(s.category[0] ?? "", (bySection.get(s.category[0] ?? "") ?? 0) + 1);
        await kv.put(`oliu:folder:${r.id}:v2`, JSON.stringify({ songs: folderSongs.length, sections: [...bySection] }), { expirationTtl: SONGS_CACHE_TTL }).catch(() => {});
      }
    } catch (reason) {
      results.push({ status: "rejected", reason });
    }
  }

  const files = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  const failed = results.flatMap((r, i) => (r.status === "rejected" ? [{ id: roots[i].id, reason: r.reason }] : []));
  for (const f of failed) unstable_rethrow(f.reason);
  if (failed.length === roots.length) throw failed[0].reason;
  for (const f of failed) console.error("Drive folder", f.id, f.reason);
  const error = failed.length
    ? `Không đọc được ${failed.length}/${roots.length} thư mục Drive: ${failed.map((f) => `${f.id} (${f.reason instanceof Error ? f.reason.message : String(f.reason)})`).join("; ")}`
    : null;
  return { songs: groupSongs(files), error };
}

// ---------- Public API ----------

export const listSongs = cache(async (options?: { forceRefresh?: boolean }): Promise<{ songs: Song[]; error: string | null }> => {
  const force = options?.forceRefresh ?? false;

  // 1. In-memory per-process cache (fastest, hits within the same worker isolate)
  if (!force) {
    const hit = memo.get("songs");
    if (hit && hit.expires > Date.now()) return hit.value as Promise<{ songs: Song[]; error: string | null }>;
  }

  // 2. Cloudflare KV cache (shared across all edge isolates, 0 Drive API requests)
  const kv = await kvBinding();
  if (kv && !force) {
    try {
      const cached = (await kv.get(SONGS_CACHE_KEY, "json")) as { songs: Song[]; error: string | null } | null;
      if (cached && Array.isArray(cached.songs) && cached.songs.length > 0) {
        memo.set("songs", { expires: Date.now() + REVALIDATE_SECONDS * 1000, value: Promise.resolve(cached) });
        return cached;
      }
    } catch (err) {
      console.error("Lỗi đọc KV:", err);
    }
  }

  // 3. Scan Google Drive
  try {
    const result = await fetchSongsFromDrive();
    // Only cache if clean (no partial errors) so failures don't stick in KV for 24 hours
    if (kv && result.songs.length > 0 && !result.error) {
      try {
        await kv.put(SONGS_CACHE_KEY, JSON.stringify(result), { expirationTtl: SONGS_CACHE_TTL });
      } catch (err) {
        console.error("Lỗi ghi KV:", err);
      }
    }
    memo.set("songs", { expires: Date.now() + REVALIDATE_SECONDS * 1000, value: Promise.resolve(result) });
    return result;
  } catch (err) {
    unstable_rethrow(err); // let Next.js's own render signals through
    console.error("Lỗi đọc Drive:", err);

    // Fallback nếu Drive bị lỗi/chạm rate limit: trả về bản lưu cũ trong KV thay vì để web sập
    if (kv) {
      try {
        const stale = (await kv.get(SONGS_CACHE_KEY, "json")) as { songs: Song[]; error: string | null } | null;
        if (stale && Array.isArray(stale.songs) && stale.songs.length > 0) {
          return {
            songs: stale.songs,
            error: "Đang tải bản lưu tạm (Google Drive đang bận hoặc giới hạn kết nối).",
          };
        }
      } catch {}
    }

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
    if (s.audio && s.audio.id === id) return s.audio;
    if (s.audios) {
      const a = s.audios.find((t) => t.id === id);
      if (a) return a;
    }
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
