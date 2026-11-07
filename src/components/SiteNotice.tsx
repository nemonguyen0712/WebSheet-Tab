import { getPaymentPause } from "@/lib/payment-pause";
import { type NoticeItem, NoticePopup } from "./NoticePopup";

/**
 * The site's announcement: a dialog when the site is opened (NoticePopup) and a scrolling band at the top of
 * every page (inside the sticky header). Its text comes from the SITE_NOTICE variable, read when the page
 * renders, so it can be changed or switched off ("off") in Cloudflare without a rebuild; {thu7} and {cn} stand
 * for this week's Saturday and Sunday ("31/10").
 */
const DEFAULT_NOTICE =
  "Các bài hát đang được kiểm tra lại và cập nhật mỗi ngày. Backing track theo karaoke trên YouTube, các bạn lên YouTube lấy backing track giúp mình ạ. Cảm ơn bạn đã chờ!";

const DEFAULT_ITEMS: NoticeItem[] = [
  {
    title: "Cập nhật bài hát",
    content: "Các bài hát đang được kiểm tra lại và cập nhật mỗi ngày.",
  },
  {
    title: "Backing track",
    content: "Backing track theo karaoke trên YouTube, các bạn lên YouTube lấy backing track giúp mình ạ.",
  },
];

/** This week's Saturday and Sunday in Vietnam time (the week runs Monday → Sunday), as "dd/mm". */
function thisWeekend(now = Date.now()) {
  const vn = new Date(now + 7 * 3_600_000);
  const day = vn.getUTCDay(); // 0 = Sunday … 6 = Saturday
  const saturday = new Date(vn.getTime() + (day === 0 ? -1 : 6 - day) * 86_400_000);
  const sunday = new Date(saturday.getTime() + 86_400_000);
  const ddmm = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  return { saturday: ddmm(saturday), sunday: ddmm(sunday) };
}

/**
 * The notice to show: SITE_NOTICE (or the default), and first of all the payment pause when it's switched on in
 * /admin, so that news reaches customers as a notice rather than as an error banner.
 */
async function notice() {
  const setting = process.env.SITE_NOTICE?.trim();
  const pause = await getPaymentPause();
  const { saturday, sunday } = thisWeekend();
  const base = setting === "off" ? null : (setting || DEFAULT_NOTICE).replaceAll("{thu7}", saturday).replaceAll("{cn}", sunday);
  if (!pause) return base ? { text: base, items: setting ? null : DEFAULT_ITEMS } : null;

  const pauseItem: NoticeItem = { title: "Tạm dừng nhận thanh toán", content: pause.message };
  const others: NoticeItem[] = !base ? [] : setting ? [{ title: "Thông báo", content: base }] : DEFAULT_ITEMS;
  return { text: [pause.message, base].filter(Boolean).join("  •  "), items: [pauseItem, ...others] };
}

/** Shown once when the site is opened (see NoticePopup); again whenever its text changes, e.g. a pause starts. */
export async function SiteNoticeDialog() {
  const n = await notice();
  return n ? <NoticePopup text={n.text} items={n.items} /> : null;
}

/** The scrolling band in the header. */
export async function SiteNotice() {
  const n = await notice();
  if (!n) return null;
  return (
    <div className="site-notice overflow-hidden bg-deep text-[15px] font-medium leading-9 text-[#f0d9a8] sm:text-base" role="note" aria-label={n.text}>
      {/* 6 copies (two sets of 3) scroll by half the track (-50%), seamlessly looping on any screen width without gaps */}
      <div className="notice-track" aria-hidden>
        {[0, 1, 2, 3, 4, 5].map((copy) => (
          <span key={copy} className="flex shrink-0 items-center gap-2.5 whitespace-nowrap pr-16 sm:pr-20">
            <span className="rounded bg-[#c9a464] px-1.5 text-xs font-bold uppercase leading-5 tracking-wide text-[#17130c]">Thông báo</span>
            {n.text}
          </span>
        ))}
      </div>
    </div>
  );
}
