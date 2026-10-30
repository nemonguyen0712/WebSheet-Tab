import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { SyncDriveButton } from "@/components/SyncDriveButton";
import { MIN_PASSWORD, formatPhone, localPhone } from "@/lib/account";
import { folderIdFrom, forgetDriveFolders, listDriveFolders, sectionFrom } from "@/lib/drive-folders";
import { ORDER_TTL_MINUTES, getOrder, isExpired, markPaid, purgeStaleOrders } from "@/lib/payments";
import { formatDate, formatDateTime, formatVnd, getPlan } from "@/lib/plans";
import { REQUEST_STATUS_LABEL, SONG_REQUESTS_PER_MONTH, type SongRequest, dayStartVN } from "@/lib/requests";
import { checkDriveFolder, clearSongsCache, listSongs, serviceAccountEmail } from "@/lib/source";
import { createAdminClient, supabaseConfigured } from "@/lib/supabase/server";
import { FILE_VIEW_LIMIT_PER_HOUR } from "@/lib/views";
import { ONLINE_WINDOW_MS, getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Quản trị" };

async function requireAdmin() {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) notFound();
  return viewer;
}

async function extend(formData: FormData) {
  "use server";
  await requireAdmin();
  const days = Number(formData.get("days"));
  const userId = String(formData.get("user"));
  const admin = createAdminClient();
  if (days > 0) await admin.rpc("extend_subscription", { p_user: userId, p_days: days });
  else await admin.from("profiles").update({ paid_until: new Date().toISOString() }).eq("id", userId);
  revalidatePath("/admin");
}

/** Manual transfers: once the money shows up in the bank app, mark the order paid (extends the plan, counts as revenue). */
async function confirmOrder(formData: FormData) {
  "use server";
  const viewer = await requireAdmin();
  const order = await getOrder(Number(formData.get("order")));
  if (order?.status === "pending") await markPaid(order.order_code, order.amount, `manual:${viewer.username}`);
  revalidatePath("/admin");
}

/** For customers who forgot their password: set a new one and tell them over Zalo/phone. */
async function resetPassword(formData: FormData) {
  "use server";
  await requireAdmin();
  const userId = String(formData.get("user"));
  const password = String(formData.get("password") ?? "").trim();
  if (password.length < MIN_PASSWORD) redirect("/admin?matkhau=ngan");
  const { error } = await createAdminClient().auth.admin.updateUserById(userId, { password });
  redirect(error ? "/admin?matkhau=loi" : "/admin?matkhau=ok");
}

const PASSWORD_MESSAGES: Record<string, string> = {
  ok: "Đã đặt lại mật khẩu. Gửi mật khẩu mới cho khách và nhắc họ đổi lại trong trang Tài khoản.",
  ngan: `Mật khẩu mới cần ít nhất ${MIN_PASSWORD} ký tự.`,
  loi: "Chưa đặt lại được mật khẩu.",
};

/** Adds a Drive folder (its link or ID) after checking the service account can read it. */
async function addFolder(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = folderIdFrom(String(formData.get("folder") ?? ""));
  if (!id) redirect("/admin?thumuc=sai#drive");
  const section = sectionFrom(formData.get("section"));
  const check = await checkDriveFolder(id, section);
  if ("error" in check) redirect("/admin?thumuc=khongdoc#drive");
  const label = String(formData.get("label") ?? "").trim().slice(0, 60);
  const { error } = await createAdminClient().from("drive_folders").upsert({ id, label, section });
  forgetDriveFolders();
  await clearSongsCache();
  redirect(error ? "/admin?thumuc=loi#drive" : `/admin?thumuc=ok&so=${check.songs}#drive`);
}

async function removeFolder(formData: FormData) {
  "use server";
  await requireAdmin();
  await createAdminClient().from("drive_folders").delete().eq("id", String(formData.get("id")));
  forgetDriveFolders();
  await clearSongsCache();
  redirect("/admin?thumuc=xoa#drive");
}

/** Re-syncs the song library from Google Drive into Cloudflare KV. */
async function syncDrive() {
  "use server";
  await requireAdmin();
  forgetDriveFolders();
  await clearSongsCache();
  const res = await listSongs({ forceRefresh: true });
  redirect(`/admin?thumuc=dongbo&so=${res.songs.length}#drive`);
}

/** A song request: done (the song is up) or rejected (with a reason; the customer gets the request back). */
async function answerRequest(formData: FormData) {
  "use server";
  await requireAdmin();
  const status = String(formData.get("status"));
  if (status !== "done" && status !== "rejected") redirect("/admin#yeu-cau");
  await createAdminClient()
    .from("song_requests")
    .update({ status, admin_note: String(formData.get("note") ?? "").trim().slice(0, 300), updated_at: new Date().toISOString() })
    .eq("id", Number(formData.get("id")));
  revalidatePath("/admin");
  redirect("/admin#yeu-cau");
}

const SECTION_LABELS = { solo: "Chỉ Solo", melody: "Chỉ Melody" } as const;

const FOLDER_MESSAGES: Record<string, string> = {
  ok: "Đã thêm thư mục. Bài trong đó lên web ngay (các máy chủ khác cập nhật trong khoảng 1 phút).",
  xoa: "Đã gỡ thư mục khỏi web. File trên Drive không bị đụng tới.",
  dongbo: "Đã đồng bộ thành công bài hát từ Google Drive vào bộ nhớ đệm KV!",
  sai: "Link không đúng: dán link thư mục Drive (có /folders/…) hoặc ID của thư mục.",
  khongdoc: "Chưa đọc được thư mục: chủ thư mục cần chia sẻ (Người xem) cho email tài khoản dịch vụ ở trên, rồi thêm lại.",
  loi: "Chưa lưu được. Đã chạy supabase/migrations/004_drive_folders.sql trong Supabase chưa?",
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; matkhau?: string; thumuc?: string; so?: string }>;
}) {
  await requireAdmin();
  if (!supabaseConfigured()) {
    return <main className="mx-auto max-w-5xl px-4 py-8 text-muted">Chưa cấu hình Supabase.</main>;
  }
  const { q = "", matkhau, thumuc, so } = await searchParams;
  const admin = createAdminClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  let usersQuery = admin.from("profiles").select("id, username, phone, paid_until, created_at").order("created_at", { ascending: false }).limit(100);
  // Search by username, or by phone (stored as 849…, so "0901 234" matches too).
  const term = q.trim().toLowerCase().replace(/[^a-z0-9._]/g, "");
  const digits = q.replace(/\D/g, "").replace(/^0/, "84");
  if (term) {
    usersQuery = usersQuery.or(digits.length >= 3 ? `username.ilike.%${term}%,phone.like.%${digits}%` : `username.ilike.%${term}%`);
  }

  await purgeStaleOrders();
  // The same search box filters orders by phone, which is the transfer note in manual mode.
  let ordersQuery = admin
    .from("orders")
    .select("order_code, plan, amount, status, created_at, paid_at, profiles!inner(username, phone)")
    .order("created_at", { ascending: false })
    .limit(30);
  if (digits.length >= 3) ordersQuery = ordersQuery.like("profiles.phone", `%${digits}%`);

  const [{ data: users }, { count: activeCount }, { data: monthOrders }, { data: orders }, { data: viewStats }] = await Promise.all([
    usersQuery,
    admin.from("profiles").select("id", { count: "exact", head: true }).gt("paid_until", now.toISOString()),
    admin.from("orders").select("amount").eq("status", "paid").gte("paid_at", monthStart),
    ordersQuery,
    admin.rpc("file_view_stats", { p_since: new Date(now.getTime() - 86_400_000).toISOString() }),
  ]);
  const revenue = (monthOrders ?? []).reduce((sum, o) => sum + o.amount, 0);

  // Traffic: accounts seen in the last few minutes / today (devices.last_seen), sheets opened in the last hour.
  const requestFields = "id, title, section, detail, status, admin_note, created_at, profiles!inner(username, phone)";
  const [{ count: onlineCount }, { count: todayCount }, { count: sheetsHour }, open, answered] = await Promise.all([
    admin.from("devices").select("id", { count: "exact", head: true }).gte("last_seen", new Date(now.getTime() - ONLINE_WINDOW_MS).toISOString()),
    admin.from("devices").select("id", { count: "exact", head: true }).gte("last_seen", dayStartVN()),
    admin.from("file_views").select("id", { count: "exact", head: true }).gte("created_at", new Date(now.getTime() - 3_600_000).toISOString()),
    // Waiting requests, oldest first; then the latest answered ones.
    admin.from("song_requests").select(requestFields).eq("status", "pending").order("created_at").limit(50),
    admin.from("song_requests").select(requestFields).neq("status", "pending").order("updated_at", { ascending: false }).limit(10),
  ]);
  type RequestRow = Omit<SongRequest, "user_id" | "updated_at"> & { profiles: { username: string; phone: string } };
  const openRequests = (open.data ?? []) as unknown as RequestRow[];
  const answeredRequests = (answered.data ?? []) as unknown as RequestRow[];
  const requestsTableMissing = Boolean(open.error);

  const { folders, tableMissing } = await listDriveFolders();
  const folderChecks = await Promise.all(folders.map((f) => checkDriveFolder(f.id, f.section)));
  const saEmail = serviceAccountEmail();

  return (
    <main className="allow-select mx-auto max-w-5xl space-y-6 px-4 py-8">
      <h1 className="rounded-lg bg-surface/90 px-4 py-3 text-2xl font-bold tracking-tight text-deep backdrop-blur-sm">Quản trị</h1>
      {matkhau && PASSWORD_MESSAGES[matkhau] && (
        <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm">{PASSWORD_MESSAGES[matkhau]}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Đang còn hạn" value={String(activeCount ?? 0)} />
        <Stat label="Doanh thu tháng này" value={formatVnd(revenue)} />
        <Stat label="Đơn đã thanh toán tháng này" value={String(monthOrders?.length ?? 0)} />
      </div>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-semibold">Lưu lượng</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Stat label={`Đang online (${ONLINE_WINDOW_MS / 60_000} phút qua)`} value={String(onlineCount ?? 0)} />
          <Stat label="Tài khoản vào web hôm nay" value={String(todayCount ?? 0)} />
          <Stat label="Lượt mở sheet 1 giờ qua" value={String(sheetsHour ?? 0)} />
        </div>
        <p className="mt-3 text-xs text-muted">
          Chỉ đếm tài khoản đã đăng nhập; khách chưa đăng nhập xem ở Cloudflare → Workers &amp; Pages → oliu → Metrics (tổng request,
          lỗi). Lượt mở sheet là việc nặng nhất của máy chủ: nếu khi đông người mà Metrics báo lỗi (nhất là “Exceeded CPU”, mã 1102)
          thì đã tới lúc lên gói Workers Paid.
        </p>
      </section>

      <section id="drive" className="scroll-mt-20 rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Thư mục Google Drive</h2>
          <form action={syncDrive}>
            <SyncDriveButton />
          </form>
        </div>
        <p className="mt-1 text-sm text-muted">
          Bài của mọi thư mục được gộp chung trên web; mục cùng tên (Solo, Melody…) gộp làm một. Thêm thư mục của người khác:
          chủ thư mục chia sẻ thư mục (quyền <b>Người xem</b>) cho{" "}
          <b className="font-mono text-fg">{saEmail ?? "(chưa cấu hình tài khoản dịch vụ)"}</b>, rồi dán link thư mục vào ô dưới.
        </p>
        {tableMissing && (
          <p className="mt-3 rounded-lg bg-[#fbe7e4] px-3 py-2 text-sm text-[#8a2d22]">
            Chưa tạo bảng lưu thư mục: mở Supabase → SQL Editor, chạy file <code>supabase/migrations/004_drive_folders.sql</code>.
          </p>
        )}
        {thumuc && FOLDER_MESSAGES[thumuc] && (
          <p className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-sm">
            {FOLDER_MESSAGES[thumuc]}
            {thumuc === "ok" && so ? ` Thư mục có ${so} bài.` : ""}
          </p>
        )}
        <ul className="mt-3 divide-y divide-border text-sm">
          {folders.map((f, i) => {
            const check = folderChecks[i];
            return (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0">
                  <span className="font-medium">{f.label || `Thư mục ${i + 1}`}</span>{" "}
                  <a
                    href={`https://drive.google.com/drive/folders/${f.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs text-muted underline-offset-2 hover:text-accent hover:underline"
                  >
                    {f.id.slice(0, 10)}…
                  </a>
                  <span className="ml-1 rounded bg-surface-2 px-1.5 py-0.5 text-xs text-muted">
                    {f.section ? SECTION_LABELS[f.section] : "Tự nhận Solo / Melody"}
                  </span>
                  <span className={`block text-xs ${"error" in check ? "text-[#b33a28]" : "text-muted"}`}>
                    {"error" in check
                      ? check.error
                      : `${check.songs} bài` +
                        (check.sections.length ? ": " + check.sections.map(([name, n]) => `${name || "ngoài mục"} ${n}`).join(" · ") : "")}
                  </span>
                </span>
                {f.source === "admin" ? (
                  <form action={removeFolder}>
                    <input type="hidden" name="id" value={f.id} />
                    <button className="h-8 rounded-md border border-border px-2 text-xs hover:border-[#b33a28] hover:text-[#b33a28]">
                      Gỡ khỏi web
                    </button>
                  </form>
                ) : (
                  <span className="text-xs text-muted">Cấu hình trên máy chủ (DRIVE_FOLDER_ID)</span>
                )}
              </li>
            );
          })}
        </ul>
        <form action={addFolder} className="mt-3 space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              name="folder"
              required
              placeholder="Link thư mục Drive (https://drive.google.com/drive/folders/…)"
              className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 text-sm"
              autoComplete="off"
            />
            <input
              name="label"
              placeholder="Tên gợi nhớ (vd: Drive của Nam)"
              maxLength={60}
              className="h-9 rounded-lg border border-border bg-bg px-3 text-sm sm:w-56"
              autoComplete="off"
            />
            <button className="h-9 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg hover:bg-deep">Thêm thư mục</button>
          </div>
          <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <legend className="sr-only">Thư mục này chứa phần nào</legend>
            <span className="text-muted">Thư mục này là:</span>
            <label className="inline-flex items-center gap-1.5">
              <input type="radio" name="section" value="" defaultChecked className="accent-[var(--accent)]" />
              Cả hai: tự chia theo thư mục con có tên “Solo” / “Melody”
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input type="radio" name="section" value="solo" className="accent-[var(--accent)]" />
              Chỉ Solo
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input type="radio" name="section" value="melody" className="accent-[var(--accent)]" />
              Chỉ Melody
            </label>
          </fieldset>
          <p className="text-xs text-muted">
            “Chỉ Solo” / “Chỉ Melody”: mỗi thư mục con của thư mục này là một bài. “Cả hai”: thư mục con tên có chữ solo (vd “SOLO”, “Bài
            solo”) vào Oliu Solo, có chữ melody / mel vào Oliu Melody, tên khác thành mục riêng.
          </p>
        </form>
      </section>

      <section id="yeu-cau" className="scroll-mt-20 rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-semibold">
          Yêu cầu bài <span className="font-normal text-muted">({openRequests.length} đang chờ)</span>
        </h2>
        <p className="mt-1 text-sm text-muted">
          Khách có gói gửi tối đa {SONG_REQUESTS_PER_MONTH} yêu cầu mỗi tháng ở trang /yeu-cau. Up bài lên Drive rồi bấm “Đã xong”;
          “Từ chối” thì khách được trả lại lượt (ghi lý do để khách biết).
        </p>
        {requestsTableMissing && (
          <p className="mt-3 rounded-lg bg-[#fbe7e4] px-3 py-2 text-sm text-[#8a2d22]">
            Chưa tạo bảng yêu cầu: mở Supabase → SQL Editor, chạy file <code>supabase/migrations/005_song_requests.sql</code>.
          </p>
        )}
        {openRequests.length > 0 && (
          <ul className="mt-3 divide-y divide-border text-sm">
            {openRequests.map((r) => (
              <li key={r.id} className="py-3">
                <p>
                  <span className="font-medium">{r.title}</span>
                  {r.section && <span className="ml-1 text-xs text-muted">({r.section === "solo" ? "Solo" : "Melody"})</span>}
                </p>
                {r.detail && <p className="mt-0.5 whitespace-pre-line break-words text-muted">{r.detail}</p>}
                <p className="mt-0.5 text-xs text-muted">
                  {r.profiles.username} · {formatPhone(r.profiles.phone)} · {formatDateTime(r.created_at)}
                </p>
                <form action={answerRequest} className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input type="hidden" name="id" value={r.id} />
                  <input
                    name="note"
                    placeholder="Phản hồi cho khách (không bắt buộc; nên ghi lý do khi từ chối)"
                    maxLength={300}
                    className="h-8 min-w-0 flex-1 rounded-md border border-border bg-bg px-2 text-xs"
                    autoComplete="off"
                  />
                  <span className="flex gap-2">
                    <button name="status" value="done" className="h-8 rounded-md bg-accent px-3 text-xs font-medium text-accent-fg hover:bg-deep">
                      Đã xong
                    </button>
                    <button
                      name="status"
                      value="rejected"
                      className="h-8 rounded-md border border-border px-3 text-xs hover:border-[#b33a28] hover:text-[#b33a28]"
                    >
                      Từ chối
                    </button>
                  </span>
                </form>
              </li>
            ))}
          </ul>
        )}
        {!requestsTableMissing && openRequests.length === 0 && <p className="mt-3 text-sm text-muted">Không có yêu cầu nào đang chờ.</p>}
        {answeredRequests.length > 0 && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-muted">Đã xử lý gần đây</summary>
            <ul className="mt-2 divide-y divide-border">
              {answeredRequests.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="font-medium">{r.title}</span>{" "}
                    <span className="text-xs text-muted">· {r.profiles.username}</span>
                    {r.admin_note && <span className="block text-xs text-muted">{r.admin_note}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-muted">{REQUEST_STATUS_LABEL[r.status]}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-semibold">Xem nhiều nhất 24 giờ qua</h2>
        <p className="mt-1 text-sm text-muted">
          Mỗi tài khoản mở tối đa {FILE_VIEW_LIMIT_PER_HOUR} file khác nhau mỗi giờ. Ai mở số file bất thường (gần như cả kho) có thể
          đang tải hàng loạt: bấm “Hết hạn” để chặn.
        </p>
        {viewStats && viewStats.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="text-left text-muted">
                <tr>
                  <th className="py-2 font-normal">Tài khoản</th>
                  <th className="py-2 text-right font-normal">File khác nhau</th>
                  <th className="py-2 text-right font-normal">Lượt mở</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(viewStats as { user_id: string; username: string; phone: string; views: number; files: number }[]).map((v) => (
                  <tr key={v.user_id}>
                    <td className="py-2">
                      <a href={`/admin?q=${encodeURIComponent(v.username)}`} className="font-medium hover:text-accent">
                        {v.username}
                      </a>{" "}
                      <span className="font-mono text-xs text-muted">{formatPhone(v.phone)}</span>
                    </td>
                    <td className={`py-2 text-right tabular-nums ${v.files >= FILE_VIEW_LIMIT_PER_HOUR ? "font-semibold text-red-600" : ""}`}>
                      {v.files}
                    </td>
                    <td className="py-2 text-right tabular-nums text-muted">{v.views}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">Chưa có lượt xem nào.</p>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Người dùng</h2>
          <form className="flex gap-2">
            <input
              name="q"
              defaultValue={q}
              placeholder="Tìm tên đăng nhập / SĐT (lọc cả đơn)…"
              className="h-9 w-56 max-w-full rounded-lg border border-border bg-bg px-3 text-sm"
            />
            <button className="h-9 rounded-lg border border-border px-3 text-sm hover:border-accent">Tìm</button>
          </form>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="text-left text-muted">
              <tr>
                <th className="py-2 font-normal">Tài khoản</th>
                <th className="py-2 font-normal">Hạn dùng</th>
                <th className="py-2 font-normal">Tham gia</th>
                <th className="py-2 text-right font-normal">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(users ?? []).map((u) => {
                const active = u.paid_until && Date.parse(u.paid_until) > now.getTime();
                return (
                  <tr key={u.id}>
                    <td className="py-2">
                      <div className="font-medium">{u.username}</div>
                      <div className="font-mono text-xs text-muted">{formatPhone(u.phone)}</div>
                    </td>
                    <td className={`py-2 ${active ? "" : "text-muted"}`}>{u.paid_until ? formatDate(u.paid_until) : "—"}</td>
                    <td className="py-2 text-muted">{formatDate(u.created_at)}</td>
                    <td className="py-2">
                      <form action={extend} className="flex justify-end gap-1">
                        <input type="hidden" name="user" value={u.id} />
                        {[30, 90, 365].map((d) => (
                          <button
                            key={d}
                            name="days"
                            value={d}
                            className="h-8 rounded-md border border-border px-2 text-xs hover:border-accent"
                          >
                            +{d} ngày
                          </button>
                        ))}
                        {active && (
                          <button name="days" value={0} className="h-8 rounded-md border border-border px-2 text-xs text-red-600 hover:border-red-400">
                            Hết hạn
                          </button>
                        )}
                      </form>
                      <form action={resetPassword} className="mt-1 flex justify-end gap-1">
                        <input type="hidden" name="user" value={u.id} />
                        <input
                          name="password"
                          placeholder="Mật khẩu mới"
                          className="h-8 w-32 rounded-md border border-border bg-bg px-2 text-xs"
                          autoComplete="off"
                          required
                        />
                        <button className="h-8 rounded-md border border-border px-2 text-xs hover:border-accent">Đặt lại MK</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-semibold">Đơn gần đây</h2>
        <p className="mt-1 text-sm text-muted">
          Chuyển khoản tay: nội dung chuyển khoản là số điện thoại của khách. Thấy trong app ngân hàng có khoản đúng số tiền, đúng
          số điện thoại, sau giờ tạo đơn thì bấm “Đã nhận tiền”, gói được cộng ngay. Đơn chưa trả hết hạn sau {ORDER_TTL_MINUTES} phút
          (khách không quét được mã nữa) nhưng vẫn xác nhận được trong 24 giờ, sau đó tự xoá.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-muted">
              <tr>
                <th className="py-2 font-normal">Đơn</th>
                <th className="py-2 font-normal">Khách · nội dung CK</th>
                <th className="py-2 font-normal">Gói</th>
                <th className="py-2 font-normal">Số tiền</th>
                <th className="py-2 font-normal">Thời gian</th>
                <th className="py-2 text-right font-normal">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(orders ?? []).map((o) => {
                const buyer = o.profiles as unknown as { username: string; phone: string } | null;
                return (
                  <tr key={o.order_code}>
                    <td className="py-2 font-mono">#{o.order_code}</td>
                    <td className="py-2">
                      <div className="font-medium">{buyer?.username}</div>
                      <div className="font-mono text-xs">{buyer && localPhone(buyer.phone)}</div>
                    </td>
                    <td className="py-2">{getPlan(o.plan)?.label ?? o.plan}</td>
                    <td className="py-2">{formatVnd(o.amount)}</td>
                    <td className="py-2 tabular-nums">
                      <div>Tạo {formatDateTime(o.created_at)}</div>
                      {o.paid_at && <div className="text-xs text-muted">Nhận {formatDateTime(o.paid_at)}</div>}
                    </td>
                    <td className="py-2 text-right">
                      {o.status === "pending" ? (
                        <form action={confirmOrder} className="inline-flex items-center gap-2">
                          <input type="hidden" name="order" value={o.order_code} />
                          <StatusBadge status={isExpired(o) ? "expired" : o.status} />
                          <button className="h-8 rounded-md border border-border px-2 text-xs hover:border-accent">Đã nhận tiền</button>
                        </form>
                      ) : (
                        <StatusBadge status={o.status} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
    </div>
  );
}
