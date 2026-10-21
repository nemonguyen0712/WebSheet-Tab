import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { formatPhone } from "@/lib/account";
import { formatDate, formatDateTime, formatVnd, getPlan } from "@/lib/plans";
import { createAdminClient, supabaseConfigured } from "@/lib/supabase/server";
import { MAX_DEVICES, getViewer } from "@/lib/viewer";
import { PasswordForm } from "./PasswordForm";

export const metadata: Metadata = { title: "Tài khoản" };

function deviceName(ua: string | null) {
  if (!ua) return "Thiết bị không rõ";
  const os = /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "Android" : /Mac OS/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Máy tính";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "";
  return [os, browser].filter(Boolean).join(" · ");
}

export default async function AccountPage() {
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
      <h1 className="rounded-lg bg-surface/90 px-4 py-3 text-2xl font-bold tracking-tight text-deep backdrop-blur-sm">Tài khoản</h1>

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
        <PasswordForm />
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
                  {formatDateTime(o.created_at)}
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
