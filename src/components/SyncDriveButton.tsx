"use client";

import { useFormStatus } from "react-dom";

export function SyncDriveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium transition-all ${
        pending
          ? "cursor-not-allowed bg-surface text-muted opacity-70"
          : "bg-bg text-fg hover:border-accent hover:text-accent active:scale-95"
      }`}
    >
      {pending ? (
        <>
          <svg className="size-3.5 animate-spin text-accent" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span>Đang đồng bộ từ Drive... (vui lòng chờ)</span>
        </>
      ) : (
        <>
          <span aria-hidden>🔄</span>
          <span>Đồng bộ lại từ Drive (Lưu KV)</span>
        </>
      )}
    </button>
  );
}
