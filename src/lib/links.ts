import type { Song, TabFile } from "./types";

export function songHref(song: Pick<Song, "id">, file?: Pick<TabFile, "id">) {
  return `/bai/${encodeURIComponent(song.id)}${file ? `/${encodeURIComponent(file.id)}` : ""}`;
}
