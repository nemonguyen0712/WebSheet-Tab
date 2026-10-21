import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { KindBadge } from "@/components/KindBadge";
import { Paywall } from "@/components/Paywall";
import { ImagePreview, LockedBlock, NotationPreview } from "@/components/previews";
import { ImageViewer } from "@/components/viewers/ImageViewer";
import { NotationViewer } from "@/components/viewers/NotationViewer";
import { PdfViewer } from "@/components/viewers/PdfViewer";
import { TextViewer } from "@/components/viewers/TextViewer";
import { ViewerError } from "@/components/viewers/ViewerError";
import { fileLabel, songSubtitle } from "@/lib/kinds";
import { formatPhone } from "@/lib/account";
import { songHref } from "@/lib/links";
import { signedFileUrl } from "@/lib/file-token";
import { trimmedText } from "@/lib/preview";
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
  const sub = songSubtitle(song);
  const here = songHref(song, current);

  return (
    <main className="mx-auto max-w-5xl px-4 pb-28">
      <div className="pt-4">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted hover:text-accent">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Tất cả bài
        </Link>
      </div>

      <h1 className="mt-3 text-2xl font-bold tracking-tight text-balance sm:text-3xl">{song.title}</h1>
      {sub && <p className="mt-1 text-muted">{sub}</p>}

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

      {!viewer?.active && (
        <p className="mt-4 rounded-lg bg-accent-soft px-3 py-2 text-sm">
          Bạn đang xem bản xem trước (1/3 đầu).{" "}
          <Link href={viewer ? "/dang-ky" : `/dang-nhap?next=${encodeURIComponent(here)}`} className="font-medium text-accent underline underline-offset-4">
            Đăng ký
          </Link>{" "}
          để xem toàn bộ.
        </p>
      )}

      <div className="mt-4">
        {viewer?.active ? (
          <FullView key={current.id} tab={current} viewer={viewer} />
        ) : (
          <PreviewView key={current.id} tab={current} viewer={viewer} returnTo={here} />
        )}
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

async function PreviewView({ tab, viewer, returnTo }: { tab: TabFile; viewer: Viewer | null; returnTo: string }) {
  const paywall = <Paywall viewer={viewer} returnTo={returnTo} />;
  const previewUrl = `/api/preview/${encodeURIComponent(tab.id)}`;
  switch (tab.kind) {
    case "pdf":
    case "image":
      return (
        <ImagePreview src={previewUrl} alt={tab.name}>
          {paywall}
        </ImagePreview>
      );
    case "notation":
      return <NotationPreview src={previewUrl}>{paywall}</NotationPreview>;
    case "text": {
      let preview: ReturnType<typeof trimmedText> | null = null;
      try {
        preview = trimmedText(await getTabText(tab));
      } catch {}
      return (
        <div>
          {preview && (
            <div className="overflow-x-auto rounded-xl border border-border bg-surface p-4 font-mono text-[15px] leading-relaxed whitespace-pre sm:p-6">
              {preview.lines.join("\n")}
            </div>
          )}
          <LockedBlock lines={Math.min(16, Math.max(6, Math.ceil((preview?.hiddenLines ?? 30) / 3)))}>{paywall}</LockedBlock>
        </div>
      );
    }
  }
}
