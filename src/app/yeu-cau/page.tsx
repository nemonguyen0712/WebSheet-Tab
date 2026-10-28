import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDate } from "@/lib/plans";
import {
  REQUEST_STATUS_LABEL,
  SONG_REQUESTS_PER_MONTH,
  type SongRequest,
  monthStartVN,
  requestsLeft,
} from "@/lib/requests";
import { createAdminClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Yêu cầu bài" };

/** Sends a request if the account still has one this month (checked again here, on the server). */
async function sendRequest(formData: FormData) {
  "use server";
  const viewer = await getViewer();
  if (!viewer) redirect("/dang-nhap?next=/yeu-cau");
  if (!viewer.active) redirect("/dang-ky");
  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  const detail = String(formData.get("detail") ?? "").trim().slice(0, 500);
  const section = String(formData.get("section") ?? "");
  if (title.length < 2) redirect("/yeu-cau?gui=ngan");
  const left = await requestsLeft(viewer.id);
  if (left === null) redirect("/yeu-cau?gui=loi");
  if (left <= 0) redirect("/yeu-cau?gui=het");
  const { error } = await createAdminClient()
    .from("song_requests")
    .insert({ user_id: viewer.id, title, detail, section: section === "solo" || section === "melody" ? section : "" });
  redirect(error ? "/yeu-cau?gui=loi" : "/yeu-cau?gui=ok");
}

const MESSAGES: Record<string, string> = {
  ok: "Đã gửi yêu cầu. Bài có trên web thì trạng thái bên dưới đổi thành “Đã có bài”.",
  het: "Bạn đã dùng hết lượt yêu cầu tháng này.",
  ngan: "Nhập tên bài bạn muốn nhé.",
  loi: "Chưa gửi được, bạn thử lại sau ít phút hoặc nhắn Zalo cho mình.",
};

const STATUS_STYLE = {
  pending: "bg-[#f5e9d3] text-[#8a5f1e]",
  done: "bg-[#dfede3] text-[#245c3b]",
  rejected: "bg-[#ede7d7] text-[#5e6b60]",
} as const;

/** The 1st of next month (Vietnam time), when requests reset. */
function nextReset() {
  const start = Date.parse(monthStartVN());
  return new Date(Date.parse(monthStartVN(start + 32 * 86_400_000))).toISOString();
}

export default async function RequestPage({ searchParams }: { searchParams: Promise<{ gui?: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/dang-nhap?next=/yeu-cau");
  const { gui } = await searchParams;

  const [left, { data }] = viewer.active
    ? await Promise.all([
        requestsLeft(viewer.id),
        createAdminClient()
          .from("song_requests")
          .select("*")
          .eq("user_id", viewer.id)
          .order("created_at", { ascending: false })
          .limit(30),
      ])
    : [0, { data: [] }];
  const mine = (data ?? []) as SongRequest[];
  const input = "w-full rounded-md border border-border bg-bg px-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div className="rounded-lg bg-surface/90 px-4 py-3 backdrop-blur-sm">
        <h1 className="text-2xl font-bold tracking-tight text-deep">Yêu cầu bài</h1>
        <p className="mt-1 text-sm text-muted">
          Chưa có bài bạn muốn? Gửi tên bài, mình sẽ soạn tab/sheet. Mỗi tháng {SONG_REQUESTS_PER_MONTH} lượt, yêu cầu bị từ chối
          được trả lại lượt.
        </p>
      </div>

      {!viewer.active ? (
        <section className="rounded-2xl border border-border bg-surface p-5 text-center">
          <p className="font-medium">Yêu cầu bài dành cho tài khoản đã đăng ký gói.</p>
          <Link href="/dang-ky?khoa=1" className="mt-4 inline-flex h-11 items-center rounded-xl bg-accent px-5 font-medium text-accent-fg">
            Đăng ký gói
          </Link>
        </section>
      ) : (
        <section className="rounded-2xl border border-border bg-surface p-5">
          {gui && MESSAGES[gui] && <p className="mb-4 rounded-lg bg-accent-soft px-3 py-2 text-sm">{MESSAGES[gui]}</p>}
          {left === null ? (
            <p className="text-sm text-muted">Chức năng đang được cài đặt, bạn quay lại sau nhé.</p>
          ) : (
            <>
              <p className="text-sm">
                Tháng này bạn còn{" "}
                <b className={left ? "text-accent" : "text-[#b33a28]"}>
                  {left}/{SONG_REQUESTS_PER_MONTH}
                </b>{" "}
                lượt{left ? "." : `. Lượt mới có từ ngày ${formatDate(nextReset())}.`}
              </p>
              <form action={sendRequest} className="mt-4 space-y-3">
                <label className="block">
                  <span className="text-sm text-muted">Tên bài (và ca sĩ)</span>
                  <input name="title" required minLength={2} maxLength={120} disabled={!left} className={`${input} mt-1 h-11`} />
                </label>
                <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" disabled={!left}>
                  <legend className="sr-only">Phần</legend>
                  <span className="text-muted">Bạn cần:</span>
                  <label className="inline-flex items-center gap-1.5">
                    <input type="radio" name="section" value="solo" className="accent-[var(--accent)]" /> Solo
                  </label>
                  <label className="inline-flex items-center gap-1.5">
                    <input type="radio" name="section" value="melody" className="accent-[var(--accent)]" /> Melody
                  </label>
                  <label className="inline-flex items-center gap-1.5">
                    <input type="radio" name="section" value="" defaultChecked className="accent-[var(--accent)]" /> Sao cũng được
                  </label>
                </fieldset>
                <label className="block">
                  <span className="text-sm text-muted">Ghi chú (link bản muốn chơi, đoạn cần tab…), không bắt buộc</span>
                  <textarea name="detail" maxLength={500} rows={3} disabled={!left} className={`${input} mt-1 py-2`} />
                </label>
                <button
                  type="submit"
                  disabled={!left}
                  className="h-11 rounded-md bg-accent px-5 text-sm font-medium text-accent-fg hover:bg-deep disabled:opacity-50"
                >
                  Gửi yêu cầu
                </button>
              </form>
            </>
          )}
        </section>
      )}

      {mine.length > 0 && (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="font-semibold">Yêu cầu của bạn</h2>
          <ul className="mt-3 divide-y divide-border text-sm">
            {mine.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="font-medium">{r.title}</span>
                  {r.section && <span className="ml-1 text-xs text-muted">({r.section === "solo" ? "Solo" : "Melody"})</span>}
                  <span className="block text-xs text-muted">Gửi ngày {formatDate(r.created_at)}</span>
                  {r.admin_note && <span className="mt-0.5 block text-xs">Phản hồi: {r.admin_note}</span>}
                  {r.status === "rejected" && <span className="block text-xs text-muted">Đã trả lại lượt cho bạn.</span>}
                </span>
                <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium ${STATUS_STYLE[r.status]}`}>
                  {REQUEST_STATUS_LABEL[r.status]}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
