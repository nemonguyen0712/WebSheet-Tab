"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The announcement as a dialog over the page when the site is opened: once per browser session (moving between
 * pages doesn't bring it back), and again whenever the text changes. Without session storage it shows on each load.
 */
export function NoticePopup({ text, lines }: { text: string; lines: [string, string][] | null }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const key = `oliu-notice:${text}`;

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(key) === "1";
    } catch {}
    if (!seen) setOpen(true);
  }, [key]);

  useEffect(() => {
    if (!open) return;
    button.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function close() {
    setOpen(false);
    try {
      sessionStorage.setItem(key, "1");
    } catch {}
  }

  if (!open) return null;
  return (
    <div
      className="notice-popup fixed inset-0 z-50 grid place-items-center bg-black/55 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="notice-title"
        className="notice-card w-full max-w-md rounded-2xl border border-[#c9a464]/50 bg-[#14231a] p-6 text-center text-[#f1e6cc] shadow-2xl"
      >
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-[#c9a464]/15 text-[#e2c58f]">
          <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z" strokeLinejoin="round" />
            <path d="M16 9a3 3 0 0 1 0 6M19 6a7 7 0 0 1 0 12" strokeLinecap="round" />
          </svg>
        </span>
        <h2 id="notice-title" className="mt-3 font-display text-2xl font-bold text-[#e2c58f]">
          Thông báo
        </h2>
        {lines ? (
          <>
            <p className="mt-2 text-lg leading-snug">Các bài hát đang được kiểm tra lại.</p>
            <dl className="mt-4 grid gap-2 text-left">
              {lines.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 rounded-xl bg-black/25 px-4 py-3">
                  <dt className="text-[#b9aa8a]">{label}</dt>
                  <dd className="text-lg font-bold text-[#e2c58f]">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-sm text-[#b9aa8a]">Tab/sheet sẽ có trong khoảng thời gian trên. Cảm ơn bạn đã chờ!</p>
          </>
        ) : (
          <p className="mt-3 whitespace-pre-line text-lg leading-snug">{text}</p>
        )}
        <button
          ref={button}
          type="button"
          onClick={close}
          className="mt-6 h-12 w-full rounded-xl bg-[#c9a464] text-base font-semibold text-[#17130c] hover:opacity-90"
        >
          Đã hiểu
        </button>
      </div>
    </div>
  );
}
