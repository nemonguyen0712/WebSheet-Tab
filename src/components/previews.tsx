"use client";

import { useState } from "react";
import { NotationViewer } from "./viewers/NotationViewer";

/** Blurred-preview image from /api/preview, with the paywall over its blurred two thirds. */
export function ImagePreview({ src, alt, children }: { src: string; alt: string; children: React.ReactNode }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <LockedBlock lines={18}>{children}</LockedBlock>;
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element -- generated preview */}
      <img src={src} alt={alt} onError={() => setFailed(true)} className="mx-auto w-full select-none" draggable={false} />
      <div className="absolute inset-x-0 bottom-0 flex h-2/3 items-center justify-center p-4">{children}</div>
    </div>
  );
}

/** Shortened Guitar Pro file (first third of the bars), followed by a locked placeholder. */
export function NotationPreview({ src, children }: { src: string; children: React.ReactNode }) {
  return (
    <div>
      <NotationViewer url={src} ext="gp" />
      <LockedBlock lines={14}>{children}</LockedBlock>
    </div>
  );
}

/**
 * Stand-in for hidden content: blurred fake staff/text lines (nothing real is sent),
 * with the paywall on top.
 */
export function LockedBlock({ lines, children }: { lines: number; children: React.ReactNode }) {
  return (
    <div className="relative mt-3 overflow-hidden rounded-xl border border-border bg-white">
      <div aria-hidden className="space-y-5 p-6 blur-[3px]">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className="space-y-1.5">
            {Array.from({ length: 4 }, (_, j) => (
              <div key={j} className="h-px bg-neutral-300" />
            ))}
            <div className="flex gap-3">
              {Array.from({ length: 6 + ((i * 7) % 5) }, (_, j) => (
                <div key={j} className="h-2 flex-1 rounded-full bg-neutral-200" />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-white/30 to-white/70 p-4">
        {children}
      </div>
    </div>
  );
}
