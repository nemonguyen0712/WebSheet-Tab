import { NoticePopup } from "./NoticePopup";

/**
 * The site's announcement: a dialog when the site is opened (NoticePopup) and a scrolling band at the top of
 * every page (inside the sticky header). Its text comes from the SITE_NOTICE variable, read when the page
 * renders, so it can be changed or switched off ("off") in Cloudflare without a rebuild; {thu7} and {cn} stand
 * for this week's Saturday and Sunday ("31/10").
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

function notice() {
  const setting = process.env.SITE_NOTICE?.trim();
  if (setting === "off") return null;
  const { saturday, sunday } = thisWeekend();
  return {
    text: (setting || DEFAULT_NOTICE).replaceAll("{thu7}", saturday).replaceAll("{cn}", sunday),
    /** The default notice is laid out as two date rows in the dialog; a custom one is shown as written. */
    lines: setting ? null : ([["Sớm nhất", `Thứ 7, ${saturday}`], ["Trễ nhất", `Chủ nhật, ${sunday}`]] as [string, string][]),
  };
}

/** Shown once when the site is opened (see NoticePopup). */
export function SiteNoticeDialog() {
  const n = notice();
  return n ? <NoticePopup text={n.text} lines={n.lines} /> : null;
}

/** The scrolling band in the header. */
export function SiteNotice() {
  const n = notice();
  if (!n) return null;
  return (
    <div className="site-notice overflow-hidden bg-deep text-[15px] font-medium leading-9 text-[#f0d9a8] sm:text-base" role="note" aria-label={n.text}>
      {/* Two copies side by side scroll by half their width, so the band loops without a gap. */}
      <div className="notice-track" aria-hidden>
        {[0, 1].map((copy) => (
          <span key={copy} className="flex shrink-0 items-center gap-2.5 whitespace-nowrap pr-20">
            <span className="rounded bg-[#c9a464] px-1.5 text-xs font-bold uppercase leading-5 tracking-wide text-[#17130c]">Thông báo</span>
            {n.text}
          </span>
        ))}
      </div>
    </div>
  );
}
