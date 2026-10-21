import Link from "next/link";
import type { Category } from "@/lib/categories";

/** "Oliu Solo" / "Oliu Melody": a section card in the brand's dark-and-gold look, linking to its own page. */
export function CategoryCard({ category }: { category: Category }) {
  return (
    <Link
      href={`/${category.slug}`}
      className="group relative flex min-h-44 flex-col items-center justify-center overflow-hidden rounded-lg border border-[#5c4a2a] bg-[#11160f] px-6 py-8 text-center shadow-lg transition hover:-translate-y-0.5 hover:border-[#c9a464] active:scale-[0.99]"
    >
      <span
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgb(98_112_52/0.55),transparent_60%),radial-gradient(ellipse_at_80%_100%,rgb(156_107_47/0.35),transparent_65%)] opacity-90 transition group-hover:opacity-100"
      />
      <span className="relative font-display text-4xl font-bold uppercase tracking-[0.12em] text-[#e2c58f] sm:text-5xl">Oliu</span>
      <span className="relative mt-2 flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.35em] text-[#e9d9b4]">
        <span aria-hidden className="h-px w-8 bg-[#c9a464]/70" />
        {category.name}
        <span aria-hidden className="h-px w-8 bg-[#c9a464]/70" />
      </span>
      <span className="relative mt-4 text-sm text-[#cfc3a6]">{category.count} bài · Xem ngay →</span>
    </Link>
  );
}
