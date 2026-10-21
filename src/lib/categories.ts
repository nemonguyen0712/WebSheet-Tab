import { fold } from "./kinds";
import type { Song } from "./types";

/**
 * Top-level Drive folders ("Solo", "Melody", …) become the site's sections: a card on the
 * home page ("Oliu Solo") and a page of their own at /solo, /melody.
 */
export interface Category {
  name: string;
  slug: string;
  count: number;
}

export function categorySlug(name: string) {
  return fold(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function categoryTitle(name: string) {
  return `Oliu ${name}`;
}

/** Solo first, then Melody, then other folders A→Z. */
export function categoryRank(name: string) {
  const f = fold(name);
  return f === "solo" ? 0 : f === "melody" ? 1 : 2;
}

const collator = new Intl.Collator("vi", { sensitivity: "base", numeric: true });

export function listCategories(songs: Song[]): Category[] {
  const counts = new Map<string, number>();
  for (const s of songs) {
    const top = s.category[0];
    if (top) counts.set(top, (counts.get(top) ?? 0) + 1);
  }
  return [...counts]
    .sort(([a], [b]) => categoryRank(a) - categoryRank(b) || collator.compare(a, b))
    .map(([name, count]) => ({ name, slug: categorySlug(name), count }));
}
