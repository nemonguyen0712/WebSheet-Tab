"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Checks the order every few seconds and reloads the page once it's paid or cancelled,
 * or once its QR expires (`expiresAt`, ms).
 */
export function OrderPoller({ orderCode, expiresAt }: { orderCode: number; expiresAt: number }) {
  const router = useRouter();
  useEffect(() => {
    let stopped = false;
    const stop = () => {
      stopped = true;
      clearInterval(timer);
      clearTimeout(expiry);
    };
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${orderCode}`, { cache: "no-store" });
        const { status } = (await res.json()) as { status?: string };
        if (!stopped && status && status !== "pending") {
          stop();
          router.refresh();
        }
      } catch {}
    }, 4000);
    const expiry = setTimeout(() => {
      stop();
      router.refresh();
    }, Math.max(0, expiresAt - Date.now()) + 500);
    return stop;
  }, [orderCode, expiresAt, router]);
  return null;
}

/** "09:41" left until the QR expires, ticking every second. */
export function ExpiryCountdown({ expiresAt }: { expiresAt: number }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (now === null) return null;
  const left = Math.max(0, Math.round((expiresAt - now) / 1000));
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  return (
    <p className="mt-3 text-sm">
      Mã QR hết hạn sau{" "}
      <b className={`font-mono tabular-nums ${left < 60 ? "text-[#b33a28]" : "text-accent"}`}>
        {mm}:{ss}
      </b>
    </p>
  );
}
