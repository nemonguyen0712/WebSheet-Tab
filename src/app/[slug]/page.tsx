import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SongBrowser } from "@/components/SongBrowser";
import { lockedRedirect } from "@/lib/access";
import { categorySlug, categoryTitle } from "@/lib/categories";
import { listSongs } from "@/lib/source";
import { getViewer } from "@/lib/viewer";

type Props = { params: Promise<{ slug: string }> };

/** The songs under one top-level Drive folder, found by its slug ("solo" → "Solo"). */
async function findCategory(slug: string) {
  const { songs, error } = await listSongs();
  const inCategory = songs.filter((s) => s.category[0] && categorySlug(s.category[0]) === slug);
  return inCategory.length ? { name: inCategory[0].category[0], songs: inCategory, error } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await findCategory((await params).slug);
  return { title: found ? categoryTitle(found.name) : "Không tìm thấy" };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const [found, viewer] = await Promise.all([findCategory(slug), getViewer()]);
  if (!found) notFound();
  const locked = lockedRedirect(viewer, `/${slug}`);
  if (locked) redirect(locked);

  return (
    <main className="mx-auto max-w-5xl px-4 pb-10">
      <div className="mt-4 rounded-lg bg-surface/90 px-4 pb-4 pt-3 backdrop-blur-sm">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted hover:text-accent">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Trang chủ
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-deep sm:text-3xl">{categoryTitle(found.name)}</h1>
        <p className="mt-0.5 text-sm text-muted">{found.songs.length} bài</p>
      </div>
      {found.error && (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{found.error}</div>
      )}
      <SongBrowser songs={found.songs} scoped />
    </main>
  );
}
