import type { Song, TabFile, TabKind } from "./types";

const EXTENSIONS: Record<TabKind, string[]> = {
  pdf: ["pdf"],
  // Everything alphaTab can render: Guitar Pro 3-8, MusicXML, Capella, alphaTex.
  notation: ["gp", "gp3", "gp4", "gp5", "gpx", "musicxml", "mxl", "capx", "atex", "alphatex"],
  text: ["txt", "tab", "crd", "cho", "chopro", "chordpro"],
  image: ["jpg", "jpeg", "png", "webp", "gif", "bmp", "avif"],
};

export const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";

/** null = not a sheet/tab (audio, video, documents…), so the site skips it. */
export function detectKind(ext: string, mimeType: string): TabKind | null {
  if (mimeType === GOOGLE_DOC_MIME) return "text";
  if (mimeType.startsWith("application/vnd.google-apps.")) return null;
  for (const [kind, exts] of Object.entries(EXTENSIONS)) {
    if (exts.includes(ext)) return kind as TabKind;
  }
  if (mimeType === "application/pdf") return "pdf";
  return null;
}

export const KIND_LABELS: Record<TabKind, string> = {
  pdf: "PDF",
  notation: "Guitar Pro",
  text: "Tab chữ",
  image: "Ảnh",
};

/** Order files are shown in on a song page. */
export const KIND_ORDER: TabKind[] = ["pdf", "notation", "image", "text"];

export function splitExt(name: string): [string, string] {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return [name, ""];
  return [name.slice(0, dot), name.slice(dot + 1).toLowerCase()];
}

/** "Tên bài - Ca sĩ" → { title: "Tên bài", artist: "Ca sĩ" } */
export function parseTitle(base: string): { title: string; artist: string | null } {
  const clean = base.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  const idx = clean.indexOf(" - ");
  if (idx === -1) return { title: clean, artist: null };
  const title = clean.slice(0, idx).trim();
  const artist = clean.slice(idx + 3).trim();
  return title ? { title, artist: artist || null } : { title: clean, artist: null };
}

/** Lowercase and strip Vietnamese diacritics so "trinh cong son" matches "Trịnh Công Sơn". */
export function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase();
}

/** "Ca sĩ · Thể loại / Con", without repeating the artist when a folder is named after them. */
export function songSubtitle(song: Pick<Song, "artist" | "category">): string {
  const category = song.category.join(" / ");
  if (!song.artist) return category;
  if (!category || fold(song.category[song.category.length - 1]) === fold(song.artist)) return song.artist;
  return `${song.artist} · ${category}`;
}

/**
 * Short name for a file inside its song, with the song title removed:
 * "INTRO ANH MỚI CHÍNH LÀ NGƯỜI EM YÊU#1.png" in song "ANH MỚI CHÍNH LÀ NGƯỜI EM YÊU" → "INTRO #1".
 */
export function fileLabel(file: Pick<TabFile, "name" | "ext" | "kind">, songTitle: string): string {
  const base = (file.ext ? splitExt(file.name)[0] : file.name).normalize("NFC").replace(/_/g, " ");
  const chars = [...base];
  let folded = "";
  const charAt: number[] = []; // folded index → index in chars
  chars.forEach((c, i) => {
    const f = fold(c);
    for (let k = 0; k < f.length; k++) charAt.push(i);
    folded += f;
  });
  const needle = fold(songTitle.normalize("NFC")).trim();
  const at = needle ? folded.indexOf(needle) : -1;
  if (at === -1) return base.trim();
  const start = charAt[at];
  const end = charAt[at + needle.length - 1] + 1;
  const rest = `${chars.slice(0, start).join("")} ${chars.slice(end).join("")}`
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–_·.]+|[\s\-–_·.]+$/g, "");
  return rest || KIND_LABELS[file.kind];
}
