"use client";

import { useEffect } from "react";

/** Form fields and anything marked .allow-select (e.g. the admin page) keep normal copy/select. */
function isEditable(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest("input, textarea, select, [contenteditable], .allow-select"));
}

/**
 * Site-wide deterrents against saving sheets: no right-click / long-press menu, no copying,
 * no dragging images out, and the usual save / print / view-source / devtools shortcuts.
 * (Screenshots can't be blocked by any website — the watermark covers that.)
 */
export function ContentGuard() {
  useEffect(() => {
    const blockUnlessEditable = (e: Event) => {
      if (!isEditable(e.target)) e.preventDefault();
    };
    const onDragStart = (e: DragEvent) => {
      if (e.target instanceof HTMLImageElement || e.target instanceof HTMLCanvasElement || e.target instanceof SVGElement) {
        e.preventDefault();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      const blocked =
        key === "f12" ||
        (mod && ["s", "p", "u"].includes(key)) || // save, print, view source
        (mod && e.shiftKey && ["i", "j", "c"].includes(key)) || // devtools
        (mod && ["c", "x", "a"].includes(key) && !isEditable(e.target)); // copy, cut, select all
      if (blocked) e.preventDefault();
    };

    document.addEventListener("contextmenu", blockUnlessEditable);
    document.addEventListener("copy", blockUnlessEditable);
    document.addEventListener("cut", blockUnlessEditable);
    document.addEventListener("selectstart", blockUnlessEditable);
    document.addEventListener("dragstart", onDragStart);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("contextmenu", blockUnlessEditable);
      document.removeEventListener("copy", blockUnlessEditable);
      document.removeEventListener("cut", blockUnlessEditable);
      document.removeEventListener("selectstart", blockUnlessEditable);
      document.removeEventListener("dragstart", onDragStart);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);
  return null;
}
