import { promises as fs } from "fs";
import path from "path";
import { unstable_rethrow } from "next/navigation";
import { cache } from "react";
import { driveAccessToken, serviceAccount } from "./google";
import { GOOGLE_DOC_MIME, KIND_ORDER, detectKind, parseTitle, splitExt } from "./kinds";
import type { Song, TabFile } from "./types";

/** How often (seconds) the site re-reads the Drive folder. */
export const REVALIDATE_SECONDS = 300;

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const MAX_DEPTH = 6;
const LOCAL_DIR = path.join(process.cwd(), "content", "tabs");

/** Drive when a service account and folder are configured; otherwise the sample files in content/tabs. */
function mode(): { type: "drive"; folder: string } | { type: "local" } {
  const folder = process.env.DRIVE_FOLDER_ID?.trim();
  return folder && serviceAccount() ? { type: "drive", folder } : { type: "local" };
}

export function isDriveMode() {
  return mode().type === "drive";
}

interface Entry {
  id: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
  size: number | null;
  modifiedTime: string | null;
}

/** Walks a folder tree, keeping only sheet/tab files. */
async function walkTree(rootId: string, list: (folderId: string) => Promise<Entry[]>, source: TabFile["source"]) {
  const out: TabFile[] = [];
  async function walk(folderId: string, folder: string[], parentId: string | null) {
    const entries = await list(folderId);
    await Promise.all(
      entries.map(async (e) => {
        if (e.isFolder) {
          if (folder.length < MAX_DEPTH) await walk(e.id, [...folder, e.name], e.id);
          return;
        }
        const isGoogleFile = e.mimeType.startsWith("application/vnd.google-apps.");
        const ext = isGoogleFile ? "" : splitExt(e.name)[1];
        const kind = detectKind(ext, e.mimeType);
        if (!kind) return; // backing tracks, video clips, other documents
        out.push({
          id: e.id,
          name: e.name,
          folder,
          parentId,
          ext,
          mimeType: e.mimeType,
          kind,
          size: e.size,
          modifiedTime: e.modifiedTime,
          source,
        });
      }),
    );
  }
  await walk(rootId, [], null);
  return out;
}

// ---------- Google Drive (private folder, read with a service account) ----------

async function driveFetch(url: string, init: RequestInit & { next?: { revalidate?: number; tags?: string[] } } = {}) {
  const token = await driveAccessToken();
  return fetch(url, { ...init, headers: { ...init.headers, authorization: `Bearer ${token}` } });
}

async function driveChildren(folderId: string): Promise<Entry[]> {
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
    const res = await driveFetch(`${DRIVE_API}/files?${params}`, {
      cache: "force-cache",
      next: { revalidate: REVALIDATE_SECONDS, tags: ["tabs"] },
    });
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

// ---------- Local folder (content/tabs) — sample data when Drive isn't configured ----------

const LOCAL_MIME: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  bmp: "image/bmp",
};

const localId = (rel: string) => Buffer.from(rel).toString("base64url");

function localPath(id: string): string {
  const rel = Buffer.from(id, "base64url").toString("utf8");
  const full = path.resolve(LOCAL_DIR, rel);
  if (!full.startsWith(LOCAL_DIR + path.sep)) throw new Error("Invalid path");
  return full;
}

async function localChildren(id: string): Promise<Entry[]> {
  const dir = id === "" ? LOCAL_DIR : localPath(id);
  const rel = id === "" ? "" : Buffer.from(id, "base64url").toString("utf8") + "/";
  let dirents;
  try {
    dirents = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return Promise.all(
    dirents
      .filter((d) => !d.name.startsWith("."))
      .map(async (d) => {
        const stat = await fs.stat(path.join(dir, d.name));
        const ext = splitExt(d.name)[1];
        return {
          id: localId(rel + d.name),
          name: d.name,
          mimeType: d.isDirectory() ? FOLDER_MIME : (LOCAL_MIME[ext] ?? "application/octet-stream"),
          isFolder: d.isDirectory(),
          size: d.isDirectory() ? null : stat.size,
          modifiedTime: stat.mtime.toISOString(),
        };
      }),
  );
}

// ---------- Songs ----------

const collator = new Intl.Collator("vi", { sensitivity: "base", numeric: true });

function groupSongs(files: TabFile[]): Song[] {
  const songs = new Map<string, Song>();
  for (const f of files) {
    const id = f.parentId ?? f.id;
    let song = songs.get(id);
    if (!song) {
      const own = parseTitle(f.ext ? splitExt(f.name)[0] : f.name);
      song = f.parentId
        ? { id, ...parseTitle(f.folder[f.folder.length - 1]), category: f.folder.slice(0, -1), files: [], modifiedTime: null }
        : { id, ...own, category: [], files: [], modifiedTime: null };
      songs.set(id, song);
    }
    song.files.push(f);
    if (f.modifiedTime && (!song.modifiedTime || f.modifiedTime > song.modifiedTime)) song.modifiedTime = f.modifiedTime;
  }
  for (const song of songs.values()) {
    song.files.sort(
      (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || collator.compare(a.name, b.name),
    );
  }
  return [...songs.values()].sort((a, b) => collator.compare(a.title, b.title));
}

// ---------- Public API ----------

export const listSongs = cache(async (): Promise<{ songs: Song[]; error: string | null }> => {
  try {
    const m = mode();
    const files =
      m.type === "drive" ? await walkTree(m.folder, driveChildren, "drive") : await walkTree("", localChildren, "local");
    return { songs: groupSongs(files), error: null };
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
  if (tab.source === "local") return new Uint8Array(await fs.readFile(localPath(tab.id)));
  const res = await driveFetch(driveContentUrl(tab), { cache: "no-store" });
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
