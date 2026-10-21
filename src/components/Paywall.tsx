import Link from "next/link";
import { PLANS, formatVnd } from "@/lib/plans";
import type { Viewer } from "@/lib/viewer";

/** Call to action shown over the blurred part of a preview. */
export function Paywall({ viewer, returnTo }: { viewer: Viewer | null; returnTo: string }) {
  const cheapest = Math.min(...PLANS.map((p) => p.price));
  let title = "Đăng ký để xem toàn bộ sheet";
  let action = { href: `/dang-nhap?next=${encodeURIComponent(returnTo)}`, label: "Đăng nhập / Tạo tài khoản" };
  if (viewer && !viewer.deviceOk) {
    title = "Tài khoản của bạn vừa đăng nhập trên thiết bị khác";
    action = { href: `/dang-nhap?next=${encodeURIComponent(returnTo)}`, label: "Đăng nhập lại trên máy này" };
  } else if (viewer) {
    title = viewer.paidUntil ? "Gói của bạn đã hết hạn" : "Đăng ký để xem toàn bộ sheet";
    action = { href: "/dang-ky", label: viewer.paidUntil ? "Gia hạn" : "Chọn gói" };
  }

  return (
    <div className="mx-auto w-full max-w-sm rounded-2xl border border-border bg-surface/95 p-5 text-center shadow-xl backdrop-blur">
      <svg viewBox="0 0 24 24" className="mx-auto size-8 text-accent" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
      </svg>
      <p className="mt-2 font-semibold text-balance">{title}</p>
      <p className="mt-1 text-sm text-muted">Toàn bộ kho Oliu, cập nhật liên tục — chỉ từ {formatVnd(cheapest)}/tháng.</p>
      <Link
        href={action.href}
        className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-accent px-5 font-medium text-accent-fg hover:opacity-90"
      >
        {action.label}
      </Link>
    </div>
  );
}
