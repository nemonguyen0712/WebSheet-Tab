"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

/** Files whose page was already refreshed once, so a genuinely broken file doesn't loop. */
const retried = new Set<string>();

/**
 * File links expire after a few minutes. Pages restored from the browser's history (Back button)
 * can still hold an old link, so when loading fails, re-render the page once to get a fresh one.
 * Returns true when a retry was started (keep showing "loading"), false when the failure is real.
 */
export function useRetryExpiredLink(url: string) {
  const router = useRouter();
  return useCallback(() => {
    const fileId = url.split("?")[0];
    if (!url.includes("?t=") || retried.has(fileId)) return false;
    retried.add(fileId);
    router.refresh();
    return true;
  }, [url, router]);
}
