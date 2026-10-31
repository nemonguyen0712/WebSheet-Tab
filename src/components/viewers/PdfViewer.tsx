"use client";

import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";
import { ToolButton, ToolGroup, Toolbar } from "./Toolbar";
import { useRetryExpiredLink } from "./useRetryExpiredLink";
import { ViewerError } from "./ViewerError";
import { Watermark } from "./Watermark";

const ZOOMS = [0.5, 0.67, 0.8, 1, 1.25, 1.5, 2, 3];
const PDFJS = "/pdfjs/pdf.min.mjs";

interface PageSize {
  width: number;
  height: number;
}

/** `watermark`: on-screen overlay; leave out when the name is already stamped into the file. */
export function PdfViewer({ url, watermark }: { url: string; watermark?: string }) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [sizes, setSizes] = useState<PageSize[]>([]);
  const [failed, setFailed] = useState(false);
  const retryExpiredLink = useRetryExpiredLink(url);
  const [zoomIdx, setZoomIdx] = useState(ZOOMS.indexOf(1));
  const [width, setWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let task: PDFDocumentLoadingTask | null = null;
    (async () => {
      try {
        // Polyfill Promise.withResolvers for Safari < 17.4 and older WebKit
        if (typeof Promise !== "undefined" && !Promise.withResolvers) {
          Promise.withResolvers = function <T>() {
            let resolve!: (value: T | PromiseLike<T>) => void;
            let reject!: (reason?: any) => void;
            const promise = new Promise<T>((res, rej) => {
              resolve = res;
              reject = rej;
            });
            return { promise, resolve, reject };
          };
        }

        // Served from public/ (scripts/copy-assets.mjs) instead of bundled: the browser is the only place it
        // runs, and a bundled copy would also land in the server build, eating into the Worker size limit.
        const pdfjs: typeof import("pdfjs-dist") = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ PDFJS);
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
        task = pdfjs.getDocument({
          url,
          withCredentials: true,
          cMapUrl: "/pdfjs/cmaps/",
          cMapPacked: true,
          standardFontDataUrl: "/pdfjs/standard_fonts/",
          wasmUrl: "/pdfjs/wasm/",
          iccUrl: "/pdfjs/iccs/",
        });
        const loaded = await task.promise;
        const pageSizes: PageSize[] = [];
        for (let n = 1; n <= loaded.numPages; n++) {
          const vp = (await loaded.getPage(n)).getViewport({ scale: 1 });
          pageSizes.push({ width: vp.width, height: vp.height });
        }
        if (cancelled) return;
        setSizes(pageSizes);
        setDoc(loaded);
      } catch (err) {
        console.error("Lỗi tải PDF:", err);
        if (!cancelled && !retryExpiredLink()) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      task?.destroy();
    };
  }, [url]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateWidth = () => {
      const w = el.clientWidth || Math.floor(el.getBoundingClientRect().width);
      if (w > 0) setWidth(w);
    };
    updateWidth();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(([entry]) => {
        const w = Math.floor(entry.contentRect.width);
        if (w > 0) setWidth(w);
      });
      ro.observe(el);
      return () => ro.disconnect();
    }
  }, []);

  if (failed) {
    return <ViewerError>Không hiển thị được file PDF này.</ViewerError>;
  }

  const zoom = ZOOMS[zoomIdx];

  return (
    <div>
      <Toolbar>
        <ToolGroup label="Thu phóng">
          <ToolButton label="Thu nhỏ" onClick={() => setZoomIdx(zoomIdx - 1)} disabled={zoomIdx === 0}>
            −
          </ToolButton>
          <button
            type="button"
            onClick={() => setZoomIdx(ZOOMS.indexOf(1))}
            className="min-w-12 rounded-md px-1 tabular-nums hover:bg-surface-2"
            title="Vừa chiều ngang"
          >
            {Math.round(zoom * 100)}%
          </button>
          <ToolButton label="Phóng to" onClick={() => setZoomIdx(zoomIdx + 1)} disabled={zoomIdx === ZOOMS.length - 1}>
            +
          </ToolButton>
        </ToolGroup>
        {doc && <span className="text-muted">{doc.numPages} trang</span>}
      </Toolbar>

      <div ref={containerRef} className="relative overflow-x-auto">
        {watermark && <Watermark text={watermark} />}
        {!doc && <div className="py-20 text-center text-muted">Đang tải PDF…</div>}
        {doc && width > 0 && (
          <div className="mx-auto flex w-max flex-col gap-3" style={{ minWidth: "100%" }}>
            {sizes.map((size, i) => (
              <PdfPage key={i} doc={doc} pageNumber={i + 1} size={size} cssWidth={Math.floor(width * zoom)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PdfPage({
  doc,
  pageNumber,
  size,
  cssWidth,
}: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  size: PageSize;
  cssWidth: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // First 2 pages are visible immediately so mobile browsers never show blank waiting for IntersectionObserver
  const [visible, setVisible] = useState(pageNumber <= 2);
  const cssHeight = Math.floor((cssWidth * size.height) / size.width);

  useEffect(() => {
    if (visible) return;
    const el = canvasRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "1200px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let task: RenderTask | null = null;
    let cancelled = false;
    (async () => {
      try {
        const page = await doc.getPage(pageNumber);
        const canvas = canvasRef.current;
        if (cancelled || !canvas) return;

        // Cap dpr at 2 to protect against Safari canvas buffer memory limits on high-res Retina displays
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const scale = cssWidth / size.width;
        const viewport = page.getViewport({ scale });

        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);

        const canvasContext = canvas.getContext("2d");
        if (!canvasContext) return;

        // Clear canvas before painting
        canvasContext.clearRect(0, 0, canvas.width, canvas.height);

        const transform = dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined;

        task = page.render({
          canvas: null,
          canvasContext,
          transform,
          viewport,
        });
        await task.promise;
      } catch (err: unknown) {
        if ((err as { name?: string })?.name !== "RenderingCancelledException") {
          console.error(`Lỗi render PDF trang ${pageNumber}:`, err);
        }
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [visible, doc, pageNumber, cssWidth, size.width]);

  return (
    <canvas
      ref={canvasRef}
      className="mx-auto block rounded-md bg-white shadow-sm ring-1 ring-border"
      style={{ width: cssWidth, height: cssHeight }}
      aria-label={`Trang ${pageNumber}`}
    />
  );
}
