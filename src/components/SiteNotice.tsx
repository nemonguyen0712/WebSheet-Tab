/**
 * A scrolling announcement band at the top of every page (inside the sticky header). Its text comes from the
 * SITE_NOTICE variable, read when the page renders, so it can be changed or switched off ("off") in Cloudflare
 * without a rebuild; {thu7} and {cn} stand for this week's Saturday and Sunday ("31/10").
 */
const DEFAULT_NOTICE =
  "Các bài hát đang được kiểm tra lại. Tab/sheet sẽ có sớm nhất Thứ 7 ({thu7}), trễ nhất Chủ nhật ({cn}). Cảm ơn bạn đã chờ!";

/** This week's Saturday and Sunday in Vietnam time (the week runs Monday → Sunday), as "dd/mm". */
function thisWeekend(now = Date.now()) {
  const vn = new Date(now + 7 * 3_600_000);
  const day = vn.getUTCDay(); // 0 = Sunday … 6 = Saturday
  const saturday = new Date(vn.getTime() + (day === 0 ? -1 : 6 - day) * 86_400_000);
  const sunday = new Date(saturday.getTime() + 86_400_000);
  const ddmm = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  return { saturday: ddmm(saturday), sunday: ddmm(sunday) };
}

export function SiteNotice() {
  const setting = process.env.SITE_NOTICE?.trim();
  if (setting === "off") return null;
  const { saturday, sunday } = thisWeekend();
  const text = (setting || DEFAULT_NOTICE).replaceAll("{thu7}", saturday).replaceAll("{cn}", sunday);

  return (
    <div className="site-notice overflow-hidden bg-deep text-[13px] leading-7 text-[#e9d2a8]" role="note" aria-label={text}>
      {/* Two copies side by side scroll by half their width, so the band loops without a gap. */}
      <div className="notice-track" aria-hidden>
        {[0, 1].map((copy) => (
          <span key={copy} className="flex shrink-0 items-center gap-2 whitespace-nowrap pr-16">
            <svg viewBox="0 0 24 24" className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z" strokeLinejoin="round" />
              <path d="M16 9a3 3 0 0 1 0 6M19 6a7 7 0 0 1 0 12" strokeLinecap="round" />
            </svg>
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}
