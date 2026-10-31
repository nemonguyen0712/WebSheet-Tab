"use client";

import { useState } from "react";
import { ImageViewer } from "./viewers/ImageViewer";
import { NotationViewer } from "./viewers/NotationViewer";
import { PdfViewer } from "./viewers/PdfViewer";
import { TextViewer } from "./viewers/TextViewer";
import { ViewerError } from "./viewers/ViewerError";
import { AudioPlayer } from "./AudioPlayer";
import { songHref } from "@/lib/links";
import type { Song, TabFile } from "@/lib/types";

export interface TabPayload {
  tab: TabFile;
  label: string;
  url: string;
  text?: string;
}

export function SongTabsViewer({
  song,
  tabs,
  initialTabId,
  watermark,
  videoUrl,
  backingUrl,
}: {
  song: Song;
  tabs: TabPayload[];
  initialTabId?: string;
  watermark: string;
  videoUrl: string | null;
  backingUrl: string | null;
}) {
  const [activeId, setActiveId] = useState<string | undefined>(
    initialTabId && tabs.some((t) => t.tab.id === initialTabId) ? initialTabId : tabs[0]?.tab.id,
  );

  const current = tabs.find((t) => t.tab.id === activeId) ?? tabs[0];

  const handleSelectTab = (t: TabPayload) => {
    if (t.tab.id === activeId) return;
    setActiveId(t.tab.id);
    // Instant URL update without a slow server-side page reload!
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", songHref(song, t.tab));
    }
  };

  return (
    <>
      {tabs.length > 0 && (
        <nav className="mt-5 flex flex-wrap gap-2" aria-label="Nội dung của bài">
          {tabs.map((t) => {
            const active = t.tab.id === current?.tab.id;
            return (
              <button
                key={t.tab.id}
                type="button"
                onClick={() => handleSelectTab(t)}
                aria-current={active ? "page" : undefined}
                className={`flex h-10 max-w-full cursor-pointer items-center gap-2 rounded-lg border px-3.5 text-sm whitespace-nowrap transition-colors active:scale-[0.97] ${
                  active
                    ? "border-accent bg-accent text-accent-fg font-medium"
                    : "border-border bg-surface hover:border-accent"
                }`}
              >
                <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M9 18V5l12-2v13" strokeLinejoin="round" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
                <span className="truncate">{t.label}</span>
              </button>
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
      )}

      <div className="mt-4">
        {current ? (
          <RenderActiveTab key={current.tab.id} payload={current} watermark={watermark} />
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-muted">
            Bản nhạc (sheet/tab) đang được cập nhật. Bạn có thể nghe trước bản thu âm ở trên!
          </div>
        )}
      </div>
    </>
  );
}

function RenderActiveTab({ payload, watermark }: { payload: TabPayload; watermark: string }) {
  const { tab, url, text } = payload;
  switch (tab.kind) {
    case "pdf":
      return <PdfViewer url={url} />;
    case "image":
      return <ImageViewer url={url} alt={tab.name} />;
    case "notation":
      return <NotationViewer url={url} ext="gp" watermark={watermark} />;
    case "text":
      return text !== undefined ? <TextViewer text={text} watermark={watermark} /> : <ViewerError>Không tải được file này.</ViewerError>;
    case "audio":
      return <AudioPlayer url={url} fileName={tab.name} />;
  }
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
