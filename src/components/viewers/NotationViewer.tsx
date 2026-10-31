"use client";

import type * as AT from "@coderline/alphatab";
import { useEffect, useRef, useState } from "react";
import { ToolButton, ToolGroup, Toolbar } from "./Toolbar";
import { usePersistentState } from "./usePersistentState";
import { useRetryExpiredLink } from "./useRetryExpiredLink";
import { ViewerError } from "./ViewerError";
import { Watermark } from "./Watermark";

declare global {
  interface Window {
    alphaTab?: typeof AT;
  }
}

const SCRIPT = "/alphatab/alphaTab.min.js";
const SCALES = [0.6, 0.75, 0.9, 1, 1.15, 1.3, 1.5];

let loader: Promise<typeof AT> | null = null;

/** alphaTab is loaded as a plain script from /public so its web workers can reuse the same file. */
function loadAlphaTab(): Promise<typeof AT> {
  if (window.alphaTab) return Promise.resolve(window.alphaTab);
  loader ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.onload = () => (window.alphaTab ? resolve(window.alphaTab) : reject(new Error("alphaTab missing")));
    s.onerror = () => {
      loader = null;
      reject(new Error("Không tải được alphaTab"));
    };
    document.head.appendChild(s);
  });
  return loader;
}

/** Draws Guitar Pro / MusicXML / alphaTex files as tab + notation. View only — no playback. */
export function NotationViewer({ url, ext, watermark }: { url: string; ext: string; watermark?: string }) {
  const mainRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<AT.AlphaTabApi | null>(null);
  const atRef = useRef<typeof AT | null>(null);

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const retryExpiredLink = useRetryExpiredLink(url);
  const [rendering, setRendering] = useState(true);
  const [tracks, setTracks] = useState<string[]>([]);
  const [trackIdx, setTrackIdx] = useState(0);
  const [tabOnly, setTabOnly] = usePersistentState("notation-tab-only", false);
  const [scaleIdx, setScaleIdx] = usePersistentState("notation-scale", SCALES.indexOf(1));
  // Saved preferences load after mount; the async setup below reads the latest values from here.
  const displayRef = useRef({ scaleIdx, tabOnly });
  displayRef.current = { scaleIdx, tabOnly };

  useEffect(() => {
    let cancelled = false;
    let api: AT.AlphaTabApi | null = null;
    (async () => {
      try {
        const at = await loadAlphaTab();
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) throw new Error(`Không tải được file (${res.status})`);
        const data = ext === "atex" || ext === "alphatex" ? await res.text() : new Uint8Array(await res.arrayBuffer());
        if (cancelled || !mainRef.current) return;

        atRef.current = at;
        // Phones: start smaller so two bars fit per line, unless the visitor picked a size before.
        let savedScale: string | null = null;
        try {
          savedScale = localStorage.getItem("notation-scale");
        } catch {}
        if (savedScale === null && window.innerWidth < 640) {
          displayRef.current.scaleIdx = SCALES.indexOf(0.75);
          setScaleIdx(displayRef.current.scaleIdx);
        }
        api = new at.AlphaTabApi(mainRef.current, {
          core: {
            scriptFile: new URL(SCRIPT, window.location.origin).href,
            fontDirectory: "/alphatab/font/",
          },
          display: {
            scale: SCALES[displayRef.current.scaleIdx] ?? 1,
            staveProfile: displayRef.current.tabOnly ? at.StaveProfile.Tab : at.StaveProfile.Default,
          },
          player: { playerMode: at.PlayerMode.Disabled, enableUserInteraction: false },
        });
        apiRef.current = api;

        api.scoreLoaded.on((score) => {
          setTracks(score.tracks.map((t) => t.name || `Track ${t.index + 1}`));
          setTrackIdx(0);
          setStatus("ready");
        });
        api.renderStarted.on(() => setRendering(true));
        api.renderFinished.on(() => setRendering(false));
        api.error.on((e) => {
          console.error(e);
          setStatus("error");
        });

        if (typeof data === "string") api.tex(data);
        else api.load(data, [0]);
      } catch (err) {
        console.error(err);
        if (!cancelled && !retryExpiredLink()) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      api?.destroy();
      apiRef.current = null;
    };
  }, [url, ext]);

  function applyDisplay(scale: number, onlyTab: boolean) {
    const api = apiRef.current;
    const at = atRef.current;
    if (!api || !at) return;
    api.settings.display.scale = scale;
    api.settings.display.staveProfile = onlyTab ? at.StaveProfile.Tab : at.StaveProfile.Default;
    api.updateSettings();
    api.render();
  }

  function selectTrack(i: number) {
    const api = apiRef.current;
    if (!api?.score) return;
    setTrackIdx(i);
    api.renderTracks([api.score.tracks[i]]);
  }

  if (status === "error") return <ViewerError>Không đọc được file này.</ViewerError>;

  return (
    <div>
      <Toolbar>
        <ToolGroup>
          <ToolButton
            label="Chỉ hiện tab"
            active={tabOnly}
            onClick={() => {
              setTabOnly(!tabOnly);
              applyDisplay(SCALES[scaleIdx], !tabOnly);
            }}
          >
            Chỉ tab
          </ToolButton>
        </ToolGroup>
        <ToolGroup label="Cỡ">
          <ToolButton
            label="Thu nhỏ"
            disabled={scaleIdx <= 0}
            onClick={() => {
              setScaleIdx(scaleIdx - 1);
              applyDisplay(SCALES[scaleIdx - 1], tabOnly);
            }}
          >
            −
          </ToolButton>
          <ToolButton
            label="Phóng to"
            disabled={scaleIdx >= SCALES.length - 1}
            onClick={() => {
              setScaleIdx(scaleIdx + 1);
              applyDisplay(SCALES[scaleIdx + 1], tabOnly);
            }}
          >
            +
          </ToolButton>
        </ToolGroup>
        {tracks.length > 1 && (
          <select
            value={trackIdx}
            onChange={(e) => selectTrack(Number(e.target.value))}
            className="h-9 max-w-full min-w-0 rounded-lg border border-border bg-surface px-2"
            aria-label="Chọn track"
          >
            {tracks.map((name, i) => (
              <option key={i} value={i}>
                {name}
              </option>
            ))}
          </select>
        )}
      </Toolbar>

      <div className="relative overflow-hidden rounded-xl border border-border">
        {watermark && <Watermark text={watermark} />}
        {(status === "loading" || rendering) && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 py-3 text-center text-sm text-neutral-500">
            Đang vẽ bản nhạc…
          </div>
        )}
        <div ref={mainRef} className="at-surface-paper min-h-[40dvh]" />
      </div>
    </div>
  );
}
