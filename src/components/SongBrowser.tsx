"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { KIND_LABELS, KIND_ORDER, fileLabel, fold, songSubtitle } from "@/lib/kinds";
import { songHref } from "@/lib/links";
import { NEW_DAYS } from "@/lib/site";
import type { Song, TabFile, TabKind } from "@/lib/types";
import { KindBadge } from "./KindBadge";

type Sort = "az" | "recent";

interface Indexed {
  song: Song;
  title: string;
  hay: string;
  files: { file: TabFile; label: string; hay: string }[];
  modified: number;
  kinds: Map<TabKind, number>;
}

const collator = new Intl.Collator("vi", { sensitivity: "base", numeric: true });

export function SongBrowser({ songs }: { songs: Song[] }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<TabKind | "all">("all");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<Sort>("az");
  const [now, setNow] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Restore filters from the URL so search results can be shared / survive "back".
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setQuery(p.get("q") ?? "");
    const k = p.get("loai");
    if (k && (KIND_ORDER as string[]).includes(k)) setKind(k as TabKind);
    setCategory(p.get("thumuc") ?? "");
    if (p.get("sx") === "moi") setSort("recent");
    setNow(Date.now());
  }, []);

  useEffect(() => {
    if (now === null) return;
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    if (kind !== "all") p.set("loai", kind);
    if (category) p.set("thumuc", category);
    if (sort === "recent") p.set("sx", "moi");
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [query, kind, category, sort, now]);

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
        const kinds = new Map<TabKind, number>();
        for (const f of song.files) kinds.set(f.kind, (kinds.get(f.kind) ?? 0) + 1);
        return {
          song,
          title: fold(song.title),
          hay: fold([song.title, song.artist ?? "", song.category.join(" ")].join(" ")),
          files: song.files.map((file) => {
            const label = fileLabel(file, song.title);
            return { file, label, hay: fold(file.name) };
          }),
          modified: song.modifiedTime ? Date.parse(song.modifiedTime) : 0,
          kinds,
        };
      }),
    [songs],
  );

  /** Top-level folders (e.g. "Solo", "Melody") with how many songs each holds. */
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of indexed) {
      const top = i.song.category[0];
      if (top) counts.set(top, (counts.get(top) ?? 0) + 1);
    }
    return [...counts].sort(([a], [b]) => collator.compare(a, b));
  }, [indexed]);

  const kindCounts = useMemo(() => {
    const counts = new Map<TabKind, number>();
    for (const i of indexed) for (const k of i.kinds.keys()) counts.set(k, (counts.get(k) ?? 0) + 1);
    return counts;
  }, [indexed]);

  const results = useMemo(() => {
    const q = fold(query.trim());
    const tokens = q.split(/\s+/).filter(Boolean);
    const out: { i: Indexed; score: number; matchedFile: Indexed["files"][number] | null }[] = [];
    for (const i of indexed) {
      if (kind !== "all" && !i.kinds.has(kind)) continue;
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
  }, [indexed, query, kind, category, sort]);

  const filtered = query.trim() !== "" || kind !== "all" || category !== "";
  const newCutoff = now === null ? Infinity : now - NEW_DAYS * 86_400_000;

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-4 border-b border-border bg-bg/95 px-4 pb-3 pt-4 backdrop-blur">
        <label className="relative block">
          <span className="sr-only">Tìm bài</span>
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm bài, ca sĩ… (gõ không dấu được)"
            className="h-12 w-full rounded-xl border border-border bg-surface pl-10 pr-10 text-base outline-none placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/30"
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
          <div className="mt-3 flex gap-1 overflow-x-auto rounded-xl bg-surface-2 p-1" role="tablist" aria-label="Phân loại">
            {[["", songs.length] as const, ...categories].map(([name, count]) => (
              <button
                key={name || "all"}
                type="button"
                role="tab"
                aria-selected={category === name}
                onClick={() => setCategory(name)}
                className={`h-10 flex-1 whitespace-nowrap rounded-lg px-4 text-sm font-medium transition-colors ${
                  category === name ? "bg-accent text-accent-fg shadow-sm" : "text-muted hover:text-fg"
                }`}
              >
                {name || "Tất cả"} <span className="opacity-70">{count}</span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Chip active={kind === "all"} onClick={() => setKind("all")}>
            {categories.length > 0 ? "Mọi loại file" : "Tất cả"}
            {categories.length === 0 && <span className="opacity-60"> {songs.length}</span>}
          </Chip>
          {KIND_ORDER.filter((k) => kindCounts.has(k)).map((k) => (
            <Chip key={k} active={kind === k} onClick={() => setKind(kind === k ? "all" : k)}>
              {KIND_LABELS[k]} <span className="opacity-60">{kindCounts.get(k)}</span>
            </Chip>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="h-9 rounded-lg border border-border bg-surface px-2"
            aria-label="Sắp xếp"
          >
            <option value="az">Tên A → Z</option>
            <option value="recent">Mới cập nhật</option>
          </select>
          <span className="ml-auto text-muted">
            {filtered ? `${results.length} / ${songs.length} bài` : `${songs.length} bài`}
          </span>
        </div>
      </div>

      {results.length === 0 ? (
        <div className="py-16 text-center text-muted">
          {songs.length === 0 ? "Chưa có bài nào." : "Không tìm thấy bài nào khớp."}
          {filtered && songs.length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setKind("all");
                  setCategory("");
                }}
                className="text-accent underline underline-offset-4"
              >
                Xóa bộ lọc
              </button>
            </div>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {results.map(({ i, matchedFile }) => {
            const sub = songSubtitle(i.song);
            return (
              <li key={i.song.id}>
                <Link
                  href={songHref(i.song, matchedFile?.file)}
                  className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-surface"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{i.song.title}</span>
                      {i.modified > newCutoff && (
                        <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
                          Mới
                        </span>
                      )}
                    </div>
                    {sub && <div className="truncate text-sm text-muted">{sub}</div>}
                    {matchedFile && (
                      <div className="truncate text-sm text-accent">
                        ↳ {matchedFile.label}
                      </div>
                    )}
                  </div>
                  <div className="flex max-w-[45%] flex-wrap justify-end gap-1">
                    {KIND_ORDER.filter((k) => i.kinds.has(k)).map((k) => (
                      <KindBadge key={k} kind={k} count={i.kinds.get(k)} />
                    ))}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-8 rounded-full border px-3 text-sm transition-colors ${
        active ? "border-accent bg-accent text-accent-fg" : "border-border bg-surface hover:border-accent"
      }`}
    >
      {children}
    </button>
  );
}
