import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { MIN_PASSWORD, formatPhone } from "@/lib/account";
import { formatDate, formatVnd, getPlan } from "@/lib/plans";
import { createAdminClient, supabaseConfigured } from "@/lib/supabase/server";
import { FILE_VIEW_LIMIT_PER_HOUR } from "@/lib/views";
import { getViewer } from "@/lib/viewer";

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

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ q?: string; matkhau?: string }> }) {
  await requireAdmin();
  if (!supabaseConfigured()) {
    return <main className="mx-auto max-w-5xl px-4 py-8 text-muted">Chưa cấu hình Supabase.</main>;
  }
  const { q = "", matkhau } = await searchParams;
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

  const [{ data: users }, { count: activeCount }, { data: monthOrders }, { data: orders }, { data: viewStats }] = await Promise.all([
    usersQuery,
    admin.from("profiles").select("id", { count: "exact", head: true }).gt("paid_until", now.toISOString()),
    admin.from("orders").select("amount").eq("status", "paid").gte("paid_at", monthStart),
    admin
      .from("orders")
      .select("order_code, plan, amount, status, created_at, profiles(username, phone)")
      .order("created_at", { ascending: false })
      .limit(30),
    admin.rpc("file_view_stats", { p_since: new Date(now.getTime() - 86_400_000).toISOString() }),
  ]);
  const revenue = (monthOrders ?? []).reduce((sum, o) => sum + o.amount, 0);

  return (
    <main className="allow-select mx-auto max-w-5xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Quản trị</h1>
      {matkhau && PASSWORD_MESSAGES[matkhau] && (
        <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm">{PASSWORD_MESSAGES[matkhau]}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Đang còn hạn" value={String(activeCount ?? 0)} />
        <Stat label="Doanh thu tháng này" value={formatVnd(revenue)} />
        <Stat label="Đơn đã thanh toán tháng này" value={String(monthOrders?.length ?? 0)} />
      </div>

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
              placeholder="Tìm tên đăng nhập / SĐT…"
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
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <tbody className="divide-y divide-border">
              {(orders ?? []).map((o) => (
                <tr key={o.order_code}>
                  <td className="py-2 font-mono">#{o.order_code}</td>
                  <td className="py-2">{(o.profiles as unknown as { username: string } | null)?.username}</td>
                  <td className="py-2">{getPlan(o.plan)?.label ?? o.plan}</td>
                  <td className="py-2">{formatVnd(o.amount)}</td>
                  <td className="py-2 text-muted">{formatDate(o.created_at)}</td>
                  <td className="py-2 text-right">
                    <StatusBadge status={o.status} />
                  </td>
                </tr>
              ))}
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
