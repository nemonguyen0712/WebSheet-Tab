import { ConfirmButton } from "@/components/ConfirmButton";
import { MIN_PASSWORD, formatPhone } from "@/lib/account";
import { createAdminClient } from "@/lib/supabase/server";
import { envAdminPhones } from "@/lib/viewer";
import { grantAccount, revokeAdmin } from "./account-actions";

const OK_MESSAGES: Record<string, (tk: string, days: string) => string> = {
  khach: (tk, days) => `Đã tạo tài khoản khách ${tk}${days ? `, tặng ${days} ngày` : ""}. Gửi tên đăng nhập (hoặc SĐT) và mật khẩu cho khách.`,
  admin: (tk) => `Đã tạo tài khoản quản trị ${tk}. Người đó đăng nhập là thấy nút Quản trị.`,
  quyen: (tk) => `Số này đã có tài khoản (${tk}): đã cấp quyền quản trị, mật khẩu giữ nguyên.`,
  thuhoi: () => "Đã thu hồi quyền quản trị.",
};

/** /admin → Cấp tài khoản: create a customer or admin account by phone + password, and list who is admin. */
export async function AccountGrantSection({ status, tk = "", days = "", msg = "", viewerId }: {
  status?: string;
  tk?: string;
  days?: string;
  msg?: string;
  viewerId: string;
}) {
  const admin = createAdminClient();
  const envPhones = envAdminPhones();
  const [granted, fromEnv] = await Promise.all([
    admin.from("profiles").select("id, username, phone").eq("is_admin", true).order("created_at"),
    envPhones.length ? admin.from("profiles").select("id, username, phone").in("phone", envPhones) : Promise.resolve({ data: [] }),
  ]);
  const migrationMissing = Boolean(granted.error);
  const envIds = new Set((fromEnv.data ?? []).map((p) => p.id));
  const admins = [
    ...(fromEnv.data ?? []).map((p) => ({ ...p, fromEnv: true })),
    ...(granted.data ?? []).filter((p) => !envIds.has(p.id)).map((p) => ({ ...p, fromEnv: false })),
  ];
  const message = status === "loi" ? msg : status && OK_MESSAGES[status]?.(tk, days);

  return (
    <section id="cap-tk" className="scroll-mt-20 rounded-2xl border border-border bg-surface p-5">
      <h2 className="font-semibold">Cấp tài khoản</h2>
      <p className="mt-1 text-sm text-muted">
        Tạo tài khoản bằng số điện thoại và mật khẩu (ít nhất {MIN_PASSWORD} ký tự). Đăng nhập bằng số điện thoại hoặc tên đăng nhập;
        để trống tên đăng nhập thì web đặt là “tk” + số điện thoại.
      </p>
      {message && (
        <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${status === "loi" ? "bg-[#fbe7e4] text-[#8a2d22]" : "bg-accent-soft"}`}>{message}</p>
      )}
      {migrationMissing && (
        <p className="mt-3 rounded-lg bg-[#fbe7e4] px-3 py-2 text-sm text-[#8a2d22]">
          Muốn cấp quyền quản trị: mở Supabase → SQL Editor, chạy file <code>supabase/migrations/007_admin_accounts.sql</code>. Tạo tài
          khoản khách thì dùng được ngay.
        </p>
      )}

      <form action={grantAccount} className="mt-3 space-y-2">
        <div className="grid gap-2 sm:grid-cols-3">
          <input name="phone" required inputMode="tel" placeholder="Số điện thoại" autoComplete="off" className={input} />
          <input name="password" required minLength={MIN_PASSWORD} placeholder="Mật khẩu" autoComplete="new-password" className={input} />
          <input name="username" placeholder="Tên đăng nhập (không bắt buộc)" autoComplete="off" className={input} />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="text-muted">Loại:</span>
          <label className="inline-flex items-center gap-1.5">
            <input type="radio" name="role" value="customer" defaultChecked className="accent-[var(--accent)]" /> Khách
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input type="radio" name="role" value="admin" className="accent-[var(--accent)]" /> Quản trị
          </label>
          <label className="inline-flex items-center gap-1.5">
            <span className="text-muted">Tặng gói (khách):</span>
            <select name="days" defaultValue="0" className="h-8 rounded-md border border-border bg-bg px-2 text-sm">
              <option value="0">Không</option>
              <option value="30">30 ngày</option>
              <option value="90">90 ngày</option>
              <option value="365">365 ngày</option>
            </select>
          </label>
          <button className="ml-auto h-9 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg hover:bg-deep">Tạo tài khoản</button>
        </div>
      </form>

      <h3 className="mt-5 text-sm font-semibold">Quản trị viên</h3>
      <ul className="mt-1 divide-y divide-border text-sm">
        {admins.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-3 py-2">
            <span>
              <span className="font-medium">{a.username}</span> <span className="font-mono text-xs text-muted">{formatPhone(a.phone)}</span>
              {a.id === viewerId && <span className="ml-1 text-xs text-muted">(bạn)</span>}
            </span>
            {a.fromEnv ? (
              <span className="text-xs text-muted">Cấu hình trên máy chủ (ADMIN_PHONES)</span>
            ) : a.id === viewerId ? null : (
              <form action={revokeAdmin}>
                <input type="hidden" name="id" value={a.id} />
                <ConfirmButton
                  message={`Thu hồi quyền quản trị của ${a.username}? Tài khoản vẫn còn, chỉ mất quyền vào /admin.`}
                  className="text-xs text-muted underline underline-offset-2 hover:text-[#b33a28]"
                >
                  Thu hồi quyền
                </ConfirmButton>
              </form>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

const input = "h-9 min-w-0 rounded-lg border border-border bg-bg px-3 text-sm";
