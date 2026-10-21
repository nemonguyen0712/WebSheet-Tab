import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { MIN_PASSWORD, formatPhone } from "@/lib/account";
import { formatDate, formatVnd, getPlan } from "@/lib/plans";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient, createClient, supabaseConfigured } from "@/lib/supabase/server";
import { MAX_DEVICES, getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Tài khoản" };

function deviceName(ua: string | null) {
  if (!ua) return "Thiết bị không rõ";
  const os = /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "Android" : /Mac OS/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Máy tính";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "";
  return [os, browser].filter(Boolean).join(" · ");
}

/** Checks a password by signing in on a throwaway client (doesn't touch the visitor's session). */
async function passwordMatches(email: string, password: string) {
  const probe = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await probe.auth.signInWithPassword({ email, password });
  // End only this check's session — the default ("global") would sign the visitor out everywhere.
  if (data.session) await probe.auth.signOut({ scope: "local" }).catch(() => {});
  return !error;
}

async function changePassword(formData: FormData) {
  "use server";
  const current = String(formData.get("current") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < MIN_PASSWORD) redirect("/tai-khoan?matkhau=ngan");
  if (password !== String(formData.get("confirm") ?? "")) redirect("/tai-khoan?matkhau=khop");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect("/dang-nhap?next=/tai-khoan");
  if (!(await passwordMatches(user.email, current))) redirect("/tai-khoan?matkhau=sai");

  const { error } = await supabase.auth.updateUser({ password });
  redirect(error ? "/tai-khoan?matkhau=loi" : "/tai-khoan?matkhau=ok");
}

const PASSWORD_MESSAGES: Record<string, [string, boolean]> = {
  ok: ["Đã đổi mật khẩu.", true],
  sai: ["Mật khẩu hiện tại không đúng.", false],
  ngan: [`Mật khẩu cần ít nhất ${MIN_PASSWORD} ký tự.`, false],
  khop: ["Hai mật khẩu không khớp.", false],
  loi: ["Chưa đổi được mật khẩu, bạn thử lại nhé.", false],
};

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ matkhau?: string }> }) {
  const passwordMessage = PASSWORD_MESSAGES[(await searchParams).matkhau ?? ""];
  const viewer = await getViewer();
  if (!viewer) redirect("/dang-nhap?next=/tai-khoan");

  const admin = supabaseConfigured() ? createAdminClient() : null;
  const [{ data: devices }, { data: orders }] = admin
    ? await Promise.all([
        admin.from("devices").select("id, user_agent, last_seen").eq("user_id", viewer.id).order("last_seen", { ascending: false }),
        admin.from("orders").select("order_code, plan, amount, status, created_at").eq("user_id", viewer.id).order("created_at", { ascending: false }).limit(20),
      ])
    : [{ data: [] }, { data: [] }];

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Tài khoản</h1>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <p className="text-sm text-muted">Tên đăng nhập</p>
        <p className="font-medium">{viewer.username}</p>
        <p className="mt-4 text-sm text-muted">Số điện thoại</p>
        <p className="font-medium">{formatPhone(viewer.phone)}</p>
        <p className="mt-4 text-sm text-muted">Gói</p>
        {viewer.isAdmin ? (
          <p className="font-medium">Quản trị viên: xem toàn bộ, không cần mua gói</p>
        ) : viewer.active && viewer.paidUntil ? (
          <p className="font-medium">Còn hạn đến {formatDate(viewer.paidUntil)}</p>
        ) : (
          <p className="font-medium">{viewer.paidUntil ? `Đã hết hạn ngày ${formatDate(viewer.paidUntil)}` : "Chưa đăng ký"}</p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/dang-ky" className="inline-flex h-10 items-center rounded-xl bg-accent px-4 text-sm font-medium text-accent-fg">
            {viewer.active ? "Gia hạn thêm" : "Đăng ký"}
          </Link>
          <form action="/auth/dang-xuat" method="post">
            <button type="submit" className="h-10 rounded-xl border border-border px-4 text-sm hover:border-accent">
              Đăng xuất
            </button>
          </form>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-semibold">Đổi mật khẩu</h2>
        <form action={changePassword} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <input
            type="password"
            name="current"
            autoComplete="current-password"
            placeholder="Mật khẩu hiện tại"
            className="h-10 rounded-lg border border-border bg-bg px-3"
            required
          />
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            placeholder="Mật khẩu mới"
            className="h-10 rounded-lg border border-border bg-bg px-3"
            required
          />
          <input
            type="password"
            name="confirm"
            autoComplete="new-password"
            placeholder="Nhập lại"
            className="h-10 rounded-lg border border-border bg-bg px-3"
            required
          />
          <button type="submit" className="h-10 rounded-lg border border-border px-4 text-sm hover:border-accent">
            Lưu
          </button>
        </form>
        {passwordMessage && (
          <p className={`mt-2 text-sm ${passwordMessage[1] ? "text-[#2f7a50]" : "text-[#b33a28]"}`}>{passwordMessage[0]}</p>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-semibold">Thiết bị đang dùng</h2>
        <p className="mt-1 text-sm text-muted">
          {MAX_DEVICES === 1
            ? "Mỗi tài khoản chỉ dùng được 1 thiết bị. Đăng nhập trên máy khác sẽ tự đăng xuất máy này."
            : `Tối đa ${MAX_DEVICES} thiết bị. Đăng nhập trên máy mới sẽ tự đăng xuất máy cũ nhất.`}
        </p>
        <ul className="mt-3 divide-y divide-border text-sm">
          {(devices ?? []).map((d) => (
            <li key={d.id} className="flex justify-between gap-3 py-2">
              <span>{deviceName(d.user_agent)}</span>
              <span className="text-muted">{formatDate(d.last_seen)}</span>
            </li>
          ))}
        </ul>
      </section>

      {orders && orders.length > 0 && (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="font-semibold">Lịch sử thanh toán</h2>
          <ul className="mt-3 divide-y divide-border text-sm">
            {orders.map((o) => (
              <li key={o.order_code} className="flex items-center justify-between gap-3 py-2">
                <span>
                  #{o.order_code} · {getPlan(o.plan)?.label ?? o.plan} · {formatVnd(o.amount)}
                </span>
                <span className="flex items-center gap-2 text-muted">
                  {formatDate(o.created_at)}
                  <StatusBadge status={o.status} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
