"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname } from "next/navigation";

export function NavigationProgress() {
  const pathname = usePathname();
  const [navigating, setNavigating] = useState(false);
  const [, startTransition] = useTransition();

  // Reset indicator when the new page has loaded
  useEffect(() => {
    setNavigating(false);
  }, [pathname]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.("a");
      if (
        !anchor ||
        anchor.target ||
        anchor.hasAttribute("download") ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey ||
        e.defaultPrevented
      ) {
        return;
      }

      const href = anchor.getAttribute("href");
      if (
        href &&
        href.startsWith("/") &&
        !href.startsWith("/#") &&
        !href.startsWith("//") &&
        href !== pathname
      ) {
        startTransition(() => {
          setNavigating(true);
        });
      }
    }

    document.addEventListener("click", handleClick, { capture: true });
    return () => document.removeEventListener("click", handleClick, { capture: true });
  }, [pathname]);

  if (!navigating) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-x-0 top-0 z-[100] h-0.5 pointer-events-none overflow-hidden bg-accent/20"
    >
      <div className="h-full w-full origin-left animate-pulse bg-accent transition-all duration-300" />
    </div>
  );
}
