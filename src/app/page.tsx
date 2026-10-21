import Link from "next/link";
import { SongBrowser } from "@/components/SongBrowser";
import { PLANS, formatVnd } from "@/lib/plans";
import { listSongs } from "@/lib/source";
import { getViewer } from "@/lib/viewer";

export default async function Home() {
  const [{ songs, error }, viewer] = await Promise.all([listSongs(), getViewer()]);
  const cheapest = Math.min(...PLANS.map((p) => p.price));

  return (
    <main className="mx-auto max-w-5xl px-4 pb-10">
      {!viewer?.active && (
        <section className="mt-4 overflow-hidden rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-amber-50 p-5 sm:flex sm:items-center sm:gap-6 sm:p-6">
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-accent">Sheet · Tab guitar</p>
            <h1 className="mt-1 text-[22px] font-bold leading-tight tracking-tight text-balance sm:text-2xl">
              Kho sheet & tab guitar, cập nhật liên tục
            </h1>
            <p className="mt-1.5 text-[15px] text-muted">
              Xem toàn bộ {songs.length > 0 ? `${songs.length} bài` : "kho tab"} và mọi bài mới, chỉ {formatVnd(cheapest)}/tháng.
            </p>
          </div>
          <Link
            href={viewer ? "/dang-ky" : "/dang-nhap?next=/dang-ky"}
            className="mt-4 inline-flex h-12 w-full shrink-0 items-center justify-center rounded-xl bg-accent px-6 font-semibold text-accent-fg shadow-sm hover:opacity-90 sm:mt-0 sm:w-auto"
          >
            Đăng ký ngay
          </Link>
        </section>
      )}
      {error && (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <p className="font-semibold">Không đọc được danh sách bài.</p>
          <p className="mt-1 break-words">{error}</p>
        </div>
      )}
      <SongBrowser songs={songs} />
    </main>
  );
}
