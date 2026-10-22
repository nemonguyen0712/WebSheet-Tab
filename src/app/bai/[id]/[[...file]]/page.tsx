import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { KindBadge } from "@/components/KindBadge";
import { ImageViewer } from "@/components/viewers/ImageViewer";
import { NotationViewer } from "@/components/viewers/NotationViewer";
import { PdfViewer } from "@/components/viewers/PdfViewer";
import { TextViewer } from "@/components/viewers/TextViewer";
import { ViewerError } from "@/components/viewers/ViewerError";
import { lockedRedirect } from "@/lib/access";
import { categorySlug, categoryTitle } from "@/lib/categories";
import { fileLabel, songSubtitle } from "@/lib/kinds";
import { formatPhone } from "@/lib/account";
import { songHref } from "@/lib/links";
import { signedFileUrl } from "@/lib/file-token";
import { getSong, getTabText } from "@/lib/source";
import type { TabFile } from "@/lib/types";
import { type Viewer, getViewer } from "@/lib/viewer";

type Props = { params: Promise<{ id: string; file?: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const song = await getSong((await params).id);
  if (!song) return { title: "Không tìm thấy" };
  return { title: song.artist ? `${song.title} - ${song.artist}` : song.title };
}

export default async function SongPage({ params }: Props) {
  const { id, file: fileParam } = await params;
  const [song, viewer] = await Promise.all([getSong(id), getViewer()]);
  if (!song) notFound();

  const current = fileParam?.[0] ? song.files.find((f) => f.id === fileParam[0]) : song.files[0];
  if (!current) notFound();
  // Paying accounts only: anyone else goes to the plan page (or logs in again on this device).
  const locked = lockedRedirect(viewer, songHref(song, current));
  if (locked || !viewer) redirect(locked ?? "/dang-ky");
  const sub = songSubtitle(song);

  return (
    <main className="mx-auto max-w-5xl px-4 pb-28">
      <div className="mt-4 rounded-lg bg-surface/85 px-4 pb-4 pt-3 backdrop-blur-sm">
        <div>
          <Link
            href={song.category[0] ? `/${categorySlug(song.category[0])}` : "/"}
            className="inline-flex items-center gap-1 text-sm text-muted hover:text-accent"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {song.category[0] ? categoryTitle(song.category[0]) : "Tất cả bài"}
          </Link>
        </div>

        <h1 className="mt-3 text-2xl font-bold tracking-tight text-balance sm:text-3xl">{song.title}</h1>
        {sub && <p className="mt-1 text-muted">{sub}</p>}
      </div>

      {song.files.length > 1 && (
        <nav className="mt-5" aria-label="Các file của bài">
          <div className="flex flex-wrap gap-2">
            {song.files.map((f) => {
              const active = f.id === current.id;
              return (
                <Link
                  key={f.id}
                  href={songHref(song, f)}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-10 max-w-full items-center gap-2 rounded-lg border px-3 text-sm whitespace-nowrap ${
                    active ? "border-accent bg-accent-soft font-medium" : "border-border bg-surface hover:border-accent"
                  }`}
                >
                  <KindBadge kind={f.kind} ext={f.ext} />
                  <span className="truncate">{fileLabel(f, song.title)}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}

      <div className="mt-4">
        <FullView key={current.id} tab={current} viewer={viewer} />
      </div>
    </main>
  );
}

async function FullView({ tab, viewer }: { tab: TabFile; viewer: Viewer }) {
  const url = signedFileUrl(tab.id, viewer);
  const mark = `${viewer.username} · ${formatPhone(viewer.phone)}`;
  switch (tab.kind) {
    case "pdf":
      // PDFs and images come with the name stamped in (see /api/file); no overlay needed.
      return <PdfViewer url={url} />;
    case "image":
      return <ImageViewer url={url} alt={tab.name} />;
    case "notation":
      return <NotationViewer url={url} ext="gp" watermark={mark} />;
    case "text":
      try {
        return <TextViewer text={await getTabText(tab)} watermark={mark} />;
      } catch {
        return <ViewerError>Không tải được file này.</ViewerError>;
      }
  }
}

