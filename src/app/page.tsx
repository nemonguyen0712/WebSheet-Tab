import Link from "next/link";
import { CategoryCard } from "@/components/CategoryCard";
import { SongBrowser } from "@/components/SongBrowser";
import { lockedRedirect } from "@/lib/access";
import { listCategories } from "@/lib/categories";
import { PLANS, formatVnd } from "@/lib/plans";
import { listSongs } from "@/lib/source";
import { getViewer } from "@/lib/viewer";

export default async function Home() {
  const [{ songs, error }, viewer] = await Promise.all([listSongs(), getViewer()]);
  const cheapest = Math.min(...PLANS.map((p) => p.price));
  const categories = listCategories(songs);
  const loose = songs.filter((s) => !s.category[0]);

  return (
    <main className="mx-auto max-w-5xl px-4 pb-10">
      {!viewer?.active && (
        <section className="mt-5 rounded-lg border border-border bg-surface p-5 sm:flex sm:items-center sm:gap-6 sm:p-7">
          <div className="flex-1">
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.2em] text-brass">Solo · Melody · Cập nhật liên tục</p>
            <h1 className="mt-2 text-[26px] font-bold leading-tight text-deep text-balance sm:text-[32px]">
              Kho sheet guitar, cập nhật liên tục
            </h1>
            <p className="mt-1.5 text-[15px] text-muted">
              Xem toàn bộ {songs.length > 0 ? `${songs.length} bài` : "kho Oliu"} và mọi bài mới, chỉ {formatVnd(cheapest)}/tháng.
            </p>
          </div>
          <Link
            href={viewer ? "/dang-ky" : "/dang-nhap?next=/dang-ky"}
            className="mt-5 inline-flex h-12 w-full shrink-0 items-center justify-center rounded-md bg-accent px-7 font-semibold text-accent-fg hover:bg-deep sm:mt-0 sm:w-auto"
          >
            Đăng ký ngay
          </Link>
        </section>
      )}
      {/* A partial failure (one of several Drive folders) is for the admin; visitors still get the other songs. */}
      {error && (songs.length === 0 || viewer?.isAdmin) && (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <p className="font-semibold">Không đọc được danh sách bài.</p>
          <p className="mt-1 break-words">{error}</p>
        </div>
      )}
      {categories.length > 0 ? (
        <>
          {/* One card per section (Oliu Solo, Oliu Melody); each opens its own page with its own search. */}
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {categories.map((c) => {
              const locked = lockedRedirect(viewer, `/${c.slug}`);
              return <CategoryCard key={c.slug} category={c} href={locked ?? `/${c.slug}`} locked={Boolean(locked)} />;
            })}
          </div>
          {loose.length > 0 && (
            <section className="mt-8">
              <h2 className="rounded-md bg-surface/90 px-3 py-2 text-xl font-bold text-deep backdrop-blur-sm">Bài khác</h2>
              <SongBrowser songs={loose} scoped />
            </section>
          )}
        </>
      ) : (
        <SongBrowser songs={songs} />
      )}
    </main>
  );
}
