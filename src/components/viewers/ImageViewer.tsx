"use client";

import { useState } from "react";
import { useRetryExpiredLink } from "./useRetryExpiredLink";
import { ViewerError } from "./ViewerError";
import { Watermark } from "./Watermark";

export function ImageViewer({ url, alt, watermark }: { url: string; alt: string; watermark: string }) {
  const [failed, setFailed] = useState(false);
  const retryExpiredLink = useRetryExpiredLink(url);
  const [actualSize, setActualSize] = useState(false);

  if (failed) return <ViewerError>Không hiển thị được ảnh này.</ViewerError>;

  return (
    <div>
      <div className="relative overflow-x-auto rounded-xl border border-border bg-white">
        <Watermark text={watermark} />
        {/* eslint-disable-next-line @next/next/no-img-element -- private Drive file served by our API */}
        <img
          src={url}
          alt={alt}
          onError={() => !retryExpiredLink() && setFailed(true)}
          onClick={() => setActualSize(!actualSize)}
          className={actualSize ? "max-w-none cursor-zoom-out" : "mx-auto w-full cursor-zoom-in"}
        />
      </div>
      <p className="mt-2 text-center text-sm text-muted">
        Chạm vào ảnh để {actualSize ? "thu về vừa màn hình" : "xem kích thước gốc"}
      </p>
    </div>
  );
}
