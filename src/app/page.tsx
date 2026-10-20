import Link from "next/link";
import { SongBrowser } from "@/components/SongBrowser";
import { PLANS, formatVnd } from "@/lib/plans";
import { isDriveMode, listSongs } from "@/lib/source";
import { getViewer } from "@/lib/viewer";

export default async function Home() {
  const [{ songs, error }, viewer] = await Promise.all([listSongs(), getViewer()]);
  const cheapest = Math.min(...PLANS.map((p) => p.price));

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16">
      {!viewer?.active && (
        <section className="mt-5 rounded-2xl border border-border bg-surface p-5 sm:flex sm:items-center sm:gap-6">
          <div className="flex-1">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Kho sheet & tab guitar, cập nhật liên tục</h1>
            <p className="mt-1 text-muted">
              Xem toàn bộ {songs.length > 0 ? `${songs.length} bài` : "kho tab"} và mọi bài mới — chỉ từ {formatVnd(cheapest)}/tháng.
            </p>
          </div>
          <Link
            href={viewer ? "/dang-ky" : "/dang-nhap?next=/dang-ky"}
            className="mt-4 inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-accent px-5 font-medium text-accent-fg hover:opacity-90 sm:mt-0"
          >
            Đăng ký ngay
          </Link>
        </section>
      )}
      {!isDriveMode() && (
        <p className="mt-4 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted">
          Đang hiển thị tab mẫu trong <code className="font-mono">content/tabs</code>. Cấu hình{" "}
          <code className="font-mono">DRIVE_FOLDER_ID</code> và <code className="font-mono">GOOGLE_SERVICE_ACCOUNT_JSON</code> để đọc
          từ Google Drive.
        </p>
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
