"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { categoryRank } from "@/lib/categories";
import { fold, sheetLabels, songSubtitle } from "@/lib/kinds";
import { songHref } from "@/lib/links";
import { NEW_DAYS } from "@/lib/site";
import type { Song, TabFile } from "@/lib/types";

type Sort = "az" | "recent";

interface Indexed {
  song: Song;
  title: string;
  hay: string;
  files: { file: TabFile; label: string; hay: string }[];
  modified: number;
  /** Named parts ("Intro", "Solo"…), shown on the card. */
  parts: string[];
}

const collator = new Intl.Collator("vi", { sensitivity: "base", numeric: true });

/**
 * Search and filters over a list of songs. `scoped`: every song is already in one section
 * (the /solo or /melody page), so there are no section tabs and cards skip the section name.
 */
export function SongBrowser({ songs, scoped = false }: { songs: Song[]; scoped?: boolean }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<Sort>("az");
  const [now, setNow] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Restore filters from the URL so search results can be shared / survive "back".
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setQuery(p.get("q") ?? "");
    setCategory(p.get("thumuc") ?? "");
    if (p.get("sx") === "moi") setSort("recent");
    setNow(Date.now());
  }, []);

  useEffect(() => {
    if (now === null) return;
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    if (category) p.set("thumuc", category);
    if (sort === "recent") p.set("sx", "moi");
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [query, category, sort, now]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const indexed = useMemo<Indexed[]>(
    () =>
      songs.map((song) => {
        const labels = sheetLabels(song);
        return {
          song,
          title: fold(song.title),
          hay: fold([song.title, song.artist ?? "", song.category.join(" ")].join(" ")),
          files: song.files.map((file) => ({ file, label: labels.get(file.id)!, hay: fold(file.name) })),
          modified: song.modifiedTime ? Date.parse(song.modifiedTime) : 0,
          parts: [...labels.values()].filter((l) => !l.startsWith("Tab/Sheet")),
        };
      }),
    [songs],
  );

  /** Top-level folders (e.g. "Solo", "Melody") with how many songs each holds. */
  const categories = useMemo(() => {
    if (scoped) return [];
    const counts = new Map<string, number>();
    for (const i of indexed) {
      const top = i.song.category[0];
      if (top) counts.set(top, (counts.get(top) ?? 0) + 1);
    }
    return [...counts].sort(([a], [b]) => categoryRank(a) - categoryRank(b) || collator.compare(a, b));
  }, [indexed, scoped]);

  const results = useMemo(() => {
    const q = fold(query.trim());
    const tokens = q.split(/\s+/).filter(Boolean);
    const out: { i: Indexed; score: number; matchedFile: Indexed["files"][number] | null }[] = [];
    for (const i of indexed) {
      if (category && i.song.category[0] !== category) continue;
      let matchedFile: Indexed["files"][number] | null = null;
      let score = 0;
      if (tokens.length) {
        if (tokens.every((t) => i.hay.includes(t))) {
          score = i.title.startsWith(q) ? 4 : i.title.includes(q) ? 3 : 2;
        } else {
          matchedFile = i.files.find((f) => tokens.every((t) => (i.hay + " " + f.hay).includes(t))) ?? null;
          if (!matchedFile) continue;
          score = 1;
        }
      }
      out.push({ i, score, matchedFile });
    }
    out.sort(
      (a, b) =>
        b.score - a.score ||
        (sort === "recent" ? b.i.modified - a.i.modified : 0) ||
        collator.compare(a.i.song.title, b.i.song.title),
    );
    return out;
  }, [indexed, query, category, sort]);

  const filtered = query.trim() !== "" || category !== "";
  const newCutoff = now === null ? Infinity : now - NEW_DAYS * 86_400_000;

  return (
    <div>
      <div className="sticky top-[var(--header-h)] z-20 -mx-4 space-y-2.5 border-b border-border/70 bg-bg/80 px-4 pb-3 pt-3 backdrop-blur-md">
        <label className="relative block">
          <span className="sr-only">Tìm bài</span>
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm bài, ca sĩ… (không dấu cũng được)"
            className="h-12 w-full rounded-md border border-[#c9c0a8] bg-surface pl-11 pr-10 text-base outline-none placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20"
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
              aria-label="Xóa tìm kiếm"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </label>

        {categories.length > 0 && (
          <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1" role="tablist" aria-label="Phân loại">
            {[["", songs.length] as const, ...categories].map(([name, count]) => (
              <button
                key={name || "all"}
                type="button"
                role="tab"
                aria-selected={category === name}
                onClick={() => setCategory(name)}
                className={`h-10 flex-1 whitespace-nowrap rounded-lg px-4 text-sm font-semibold transition-colors ${
                  category === name ? "bg-accent text-accent-fg shadow-sm" : "text-muted hover:bg-surface-2 hover:text-fg"
                }`}
              >
                {name || "Tất cả"} <span className="font-normal opacity-75">{count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-sm">
        <span className="rounded-md bg-surface/90 px-2.5 py-1 text-muted backdrop-blur-sm">
          {filtered ? `${results.length} / ${songs.length} bài` : `${songs.length} bài`}
        </span>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="h-9 rounded-lg border border-border bg-surface px-2"
          aria-label="Sắp xếp"
        >
          <option value="az">Tên A → Z</option>
          <option value="recent">Mới cập nhật</option>
        </select>
      </div>

      {results.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-border bg-surface/80 py-14 text-center text-muted">
          {songs.length === 0 ? "Chưa có bài nào." : "Không tìm thấy bài nào khớp."}
          {filtered && songs.length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setCategory("");
                }}
                className="font-medium text-accent underline underline-offset-4"
              >
                Xóa bộ lọc
              </button>
            </div>
          )}
        </div>
      ) : categories.length > 0 && !category ? (
        // One column per top-level folder (Solo | Melody), side by side on wider screens.
        <div className="mt-3 grid items-start gap-6 md:grid-cols-2">
          {columnsOf(results, categories.map(([name]) => name)).map(([name, items]) => (
            <section key={name}>
              <h2 className="mb-2 flex items-baseline gap-2 rounded-md border-b-2 border-brass/50 bg-surface/90 px-3 py-2 text-xl font-bold text-deep backdrop-blur-sm">
                {name}
                <span className="font-sans text-sm font-normal text-muted">{items.length} bài</span>
              </h2>
              <ul className="grid gap-2">
                {items.map((r) => (
                  <SongCard key={r.i.song.id} {...r} newCutoff={newCutoff} inColumn />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {results.map((r) => (
            <SongCard key={r.i.song.id} {...r} newCutoff={newCutoff} inColumn={scoped} />
          ))}
        </ul>
      )}
    </div>
  );
}

type Result = { i: Indexed; matchedFile: Indexed["files"][number] | null };

/** One group per category (already in display order); songs outside any folder go under "Khác". */
function columnsOf(results: Result[], names: string[]): [string, Result[]][] {
  const groups = new Map<string, Result[]>(names.map((n) => [n, []]));
  for (const r of results) {
    const key = r.i.song.category[0] ?? "Khác";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  return [...groups].filter(([, items]) => items.length > 0);
}

function SongCard({ i, matchedFile, newCutoff, inColumn }: Result & { newCutoff: number; inColumn?: boolean }) {
  const router = useRouter();
  // Inside a Solo / Melody column or page the category is already the title.
  const sub = songSubtitle(inColumn ? { ...i.song, category: i.song.category.slice(1) } : i.song);
  const href = songHref(i.song, matchedFile?.file);

  return (
    <li>
      <Link
        href={href}
        prefetch={true}
        onPointerDown={() => router.prefetch(href)}
        className="flex h-full flex-col gap-2 rounded-lg border border-border bg-surface p-4 transition hover:border-brass active:scale-[0.985]"
      >
        <div className="flex items-start gap-2">
          <span className="line-clamp-2 flex-1 font-semibold leading-snug text-deep">{i.song.title}</span>
          <div className="mt-0.5 flex shrink-0 items-center gap-1">
            {i.song.audio && (
              <span className="flex items-center gap-1 rounded-sm bg-accent/10 px-1.5 py-0.5 text-[10.5px] font-semibold text-accent" title="Có bản thu âm / beat">
                <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18V5l12-2v13" strokeLinejoin="round" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
                Audio
              </span>
            )}
            {i.modified > newCutoff && (
              <span className="rounded-sm border border-[#e9d2a8] bg-brass-soft px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-brass">
                Mới
              </span>
            )}
          </div>
        </div>
        {sub && <div className="-mt-1 truncate text-sm text-muted">{sub}</div>}
        {matchedFile && <div className="-mt-1 truncate text-sm text-brass">↳ {matchedFile.label}</div>}
        {i.parts.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1">
            {i.parts.map((p) => (
              <span key={p} className="rounded-sm bg-surface-2 px-1.5 py-0.5 text-xs text-muted">
                {p}
              </span>
            ))}
          </div>
        )}
      </Link>
    </li>
  );
}
