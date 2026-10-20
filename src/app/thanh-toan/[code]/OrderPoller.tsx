"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Checks the order every few seconds and reloads the page once it's paid or cancelled. */
export function OrderPoller({ orderCode }: { orderCode: number }) {
  const router = useRouter();
  useEffect(() => {
    let stopped = false;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${orderCode}`, { cache: "no-store" });
        const { status } = (await res.json()) as { status?: string };
        if (!stopped && status && status !== "pending") {
          clearInterval(timer);
          router.refresh();
        }
      } catch {}
    }, 4000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [orderCode, router]);
  return null;
}
