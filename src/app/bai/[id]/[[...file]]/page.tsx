import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AudioPlayer } from "@/components/AudioPlayer";
import { SongTabsViewer } from "@/components/SongTabsViewer";
import { lockedRedirect } from "@/lib/access";
import { categorySlug, categoryTitle } from "@/lib/categories";
import { sheetLabels, songSubtitle } from "@/lib/kinds";
import { formatPhone } from "@/lib/account";
import { songHref } from "@/lib/links";
import { signedFileUrl } from "@/lib/file-token";
import { getLinkUrl, getSong, getTabText } from "@/lib/source";
import { getViewer } from "@/lib/viewer";

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
  if (!current && !song.audio) notFound();
  // Paying accounts only: anyone else goes to the plan page (or logs in again on this device).
  const locked = lockedRedirect(viewer, current ? songHref(song, current) : `/bai/${song.id}`);
  if (locked || !viewer) redirect(locked ?? "/dang-ky");
  const sub = songSubtitle(song);
  const labels = sheetLabels(song);
  const mark = `${viewer.username} · ${formatPhone(viewer.phone)}`;

  const [videoUrl, backingUrl, tabs] = await Promise.all([
    song.links.video ? getLinkUrl(song.links.video) : null,
    song.links.backing ? getLinkUrl(song.links.backing) : null,
    Promise.all(
      song.files.map(async (f) => ({
        tab: f,
        label: labels.get(f.id) || f.name,
        url: signedFileUrl(f.id, viewer),
        text: f.kind === "text" ? await getTabText(f).catch(() => undefined) : undefined,
      })),
    ),
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

      {song.audio && (
        <div className="mt-4">
          <AudioPlayer
            url={signedFileUrl(song.audio.id, viewer)}
            title={song.title}
            fileName={song.audio.name}
          />
        </div>
      )}

      <SongTabsViewer
        song={song}
        tabs={tabs}
        initialTabId={current?.id}
        watermark={mark}
        videoUrl={videoUrl}
        backingUrl={backingUrl}
      />
    </main>
  );
}

