/**
 * The payment pause (/admin → Thanh toán) as a calm notice on the plan, payment and donation views; site-wide it
 * rides in the regular notice band and dialog (SiteNotice). Styled as information, not as an error.
 */
export function PauseNotice({ message, className = "" }: { message: string; className?: string }) {
  return (
    <div role="status" className={`flex gap-2.5 rounded-xl border border-[#e2c58f] bg-[#f8efdc] px-3 py-2.5 text-sm text-[#5c4318] ${className}`}>
      <svg viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0 text-[#9c6b2f]" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 8h.01" strokeLinecap="round" />
      </svg>
      <p className="flex-1">
        <b>Tạm dừng nhận thanh toán.</b> {message}
      </p>
    </div>
  );
}
