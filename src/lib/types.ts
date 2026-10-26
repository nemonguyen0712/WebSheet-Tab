/** The file types the site shows. Everything else in Drive (backing tracks, video clips…) is ignored. */
export type TabKind = "pdf" | "notation" | "text" | "image";

export interface TabFile {
  id: string;
  /** Original file name, including extension. */
  name: string;
  /** Folder path from the root folder, e.g. ["Bolero", "Anh mới chính là người em yêu"]. */
  folder: string[];
  /** ID of the folder the file is in; null when it sits directly in the root folder. */
  parentId: string | null;
  ext: string;
  mimeType: string;
  kind: TabKind;
  size: number | null;
  modifiedTime: string | null;
}

/** Extra buttons on a song page, each fed by a small file in the song folder holding a YouTube link. */
export type LinkKind = "video" | "backing";

/**
 * A song: every viewable file in one folder (intro tab, chorus tab, PDF…).
 * Files placed directly in the root folder each become a song of their own.
 */
export interface Song {
  id: string;
  title: string;
  artist: string | null;
  /** Folders above the song, used as categories. */
  category: string[];
  files: TabFile[];
  /** "video.txt" (tutorial) and "backing.txt" (backing track): files whose text is a YouTube link. */
  links: Partial<Record<LinkKind, TabFile>>;
  modifiedTime: string | null;
}
