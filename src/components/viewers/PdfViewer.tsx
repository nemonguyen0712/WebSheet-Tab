"use client";

import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";
import { ToolButton, ToolGroup, Toolbar } from "./Toolbar";
import { useRetryExpiredLink } from "./useRetryExpiredLink";
import { ViewerError } from "./ViewerError";
import { Watermark } from "./Watermark";

const ZOOMS = [0.5, 0.67, 0.8, 1, 1.25, 1.5, 2, 3];

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
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
        task = pdfjs.getDocument({
          url,
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
        console.error(err);
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
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
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
  const [visible, setVisible] = useState(false);
  const cssHeight = Math.floor((cssWidth * size.height) / size.width);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => entry.isIntersecting && setVisible(true), {
      rootMargin: "1200px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let task: RenderTask | null = null;
    let cancelled = false;
    (async () => {
      const page = await doc.getPage(pageNumber);
      const canvas = canvasRef.current;
      if (cancelled || !canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const viewport = page.getViewport({ scale: (cssWidth / size.width) * dpr });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      task = page.render({ canvas, viewport });
      await task.promise.catch(() => {});
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
