import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ImageViewer } from "@/components/viewers/ImageViewer";
import { NotationViewer } from "@/components/viewers/NotationViewer";
import { PdfViewer } from "@/components/viewers/PdfViewer";
import { TextViewer } from "@/components/viewers/TextViewer";
import { ViewerError } from "@/components/viewers/ViewerError";
import { lockedRedirect } from "@/lib/access";
import { categorySlug, categoryTitle } from "@/lib/categories";
import { sheetLabels, songSubtitle } from "@/lib/kinds";
import { formatPhone } from "@/lib/account";
import { songHref } from "@/lib/links";
import { signedFileUrl } from "@/lib/file-token";
import { getLinkUrl, getSong, getTabText } from "@/lib/source";
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
  const labels = sheetLabels(song);
  const [videoUrl, backingUrl] = await Promise.all([
    song.links.video ? getLinkUrl(song.links.video) : null,
    song.links.backing ? getLinkUrl(song.links.backing) : null,
  ]);

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

      <nav className="mt-5 flex flex-wrap gap-2" aria-label="Nội dung của bài">
        {/* Sheets by part ("Tab/Sheet", "Intro", "Solo"…), without file types. */}
        {song.files.map((f) => {
          const active = f.id === current.id;
          return (
            <Link
              key={f.id}
              href={songHref(song, f)}
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={`flex h-10 max-w-full items-center gap-2 rounded-lg border px-3.5 text-sm whitespace-nowrap ${
                active ? "border-accent bg-accent text-accent-fg font-medium" : "border-border bg-surface hover:border-accent"
              }`}
            >
              <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M9 18V5l12-2v13" strokeLinejoin="round" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
              <span className="truncate">{labels.get(f.id)}</span>
            </Link>
          );
        })}
        <ExternalButton href={videoUrl} label="Video hướng dẫn">
          <path d="M8 5v14l11-7z" strokeLinejoin="round" />
        </ExternalButton>
        <ExternalButton href={backingUrl} label="Backing track">
          <path d="M3 14v-2a9 9 0 0 1 18 0v2" />
          <path d="M21 15a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2zM3 15a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2z" strokeLinejoin="round" />
        </ExternalButton>
      </nav>

      <div className="mt-4">
        <FullView key={current.id} tab={current} viewer={viewer} />
      </div>
    </main>
  );
}

/** Opens a YouTube link (tutorial, backing track) in a new tab; greyed out with "Chưa có" until there is one. */
function ExternalButton({ href, label, children }: { href: string | null; label: string; children: React.ReactNode }) {
  const icon = (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      {children}
    </svg>
  );
  if (!href) {
    return (
      <span
        aria-disabled
        className="flex h-10 items-center gap-2 rounded-lg border border-dashed border-border bg-surface/70 px-3.5 text-sm whitespace-nowrap text-muted"
      >
        {icon}
        {label}
        <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">Chưa có</span>
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-10 items-center gap-2 rounded-lg border border-[#e3b4ad] bg-surface px-3.5 text-sm whitespace-nowrap text-[#b3261e] hover:border-[#b3261e]"
    >
      {icon}
      {label}
      <span aria-hidden>↗</span>
    </a>
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

