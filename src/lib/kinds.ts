import type { LinkKind, Song, TabFile, TabKind } from "./types";

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

/** Order files are shown in on a song page. */
export const KIND_ORDER: TabKind[] = ["pdf", "notation", "image", "text"];

/**
 * A link file rather than a sheet: a .txt / .url file or Google Doc named "video…" / "hướng dẫn…" (tutorial)
 * or "backing…" / "beat…" (backing track), whose text is a YouTube link.
 */
export function detectLinkKind(name: string, ext: string, mimeType: string): LinkKind | null {
  if (!(ext === "txt" || ext === "url" || mimeType === GOOGLE_DOC_MIME)) return null;
  const base = fold(ext ? splitExt(name)[0] : name).trim();
  if (/^(backing|beat)/.test(base)) return "backing";
  if (/^(video|huong dan)/.test(base)) return "video";
  return null;
}

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
 * The part a file covers, from its name with the song title removed:
 * "INTRO ANH MỚI CHÍNH LÀ NGƯỜI EM YÊU#1.png" in song "ANH MỚI CHÍNH LÀ NGƯỜI EM YÊU" → "Intro #1".
 * "" when the name is just the song title (the whole song).
 */
export function partName(file: Pick<TabFile, "name" | "ext">, songTitle: string): string {
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
  let rest = base;
  if (at !== -1) {
    const start = charAt[at];
    const end = charAt[at + needle.length - 1] + 1;
    rest = `${chars.slice(0, start).join("")} ${chars.slice(end).join("")}`;
  }
  rest = rest.replace(/\s+/g, " ").replace(/^[\s\-–_·.]+|[\s\-–_·.]+$/g, "");
  // "INTRO" → "Intro", "GIANG TẤU" → "Giang tấu", "solo" → "Solo"; mixed case is otherwise left as typed.
  if (rest === rest.toLocaleUpperCase("vi")) rest = rest.toLocaleLowerCase("vi");
  return rest.charAt(0).toLocaleUpperCase("vi") + rest.slice(1);
}

/**
 * What each file of a song is called on the site: its part ("Intro", "Solo"…) or "Tab/Sheet" for the
 * whole song, numbered when two files would read the same. Keyed by file id.
 */
export function sheetLabels(song: Pick<Song, "title" | "files">): Map<string, string> {
  const names = song.files.map((f) => partName(f, song.title) || "Tab/Sheet");
  const total = new Map<string, number>();
  for (const n of names) total.set(fold(n), (total.get(fold(n)) ?? 0) + 1);
  const seen = new Map<string, number>();
  return new Map(
    song.files.map((f, i) => {
      const key = fold(names[i]);
      const nth = (seen.get(key) ?? 0) + 1;
      seen.set(key, nth);
      return [f.id, total.get(key)! > 1 ? `${names[i]} ${nth}` : names[i]];
    }),
  );
}
