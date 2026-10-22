import Link from "next/link";
import type { Category } from "@/lib/categories";

/**
 * "Oliu Solo" / "Oliu Melody": a section card in the brand's dark-and-gold look, linking to its own page.
 * Without an active plan it is `locked`: it says so and `href` leads to the plan page instead.
 */
export function CategoryCard({ category, href, locked }: { category: Category; href: string; locked?: boolean }) {
  return (
    <Link
      href={href}
      className="group relative flex min-h-44 flex-col items-center justify-center overflow-hidden rounded-lg border border-[#5c4a2a] bg-[#11160f] px-6 py-8 text-center shadow-lg transition hover:-translate-y-0.5 hover:border-[#c9a464] active:scale-[0.99]"
    >
      <span
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgb(98_112_52/0.55),transparent_60%),radial-gradient(ellipse_at_80%_100%,rgb(156_107_47/0.35),transparent_65%)] opacity-90 transition group-hover:opacity-100"
      />
      {locked && (
        <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-md border border-[#c9a464]/50 bg-black/40 px-2 py-1 text-xs font-medium text-[#e2c58f]">
          <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
          </svg>
          Chưa đăng ký gói
        </span>
      )}
      <span className="relative font-display text-4xl font-bold uppercase tracking-[0.12em] text-[#e2c58f] sm:text-5xl">Oliu</span>
      <span className="relative mt-2 flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.35em] text-[#e9d9b4]">
        <span aria-hidden className="h-px w-8 bg-[#c9a464]/70" />
        {category.name}
        <span aria-hidden className="h-px w-8 bg-[#c9a464]/70" />
      </span>
      <span className="relative mt-4 text-sm text-[#cfc3a6]">
        {category.count} bài · {locked ? "Đăng ký gói để xem →" : "Xem ngay →"}
      </span>
    </Link>
  );
}
