"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { localPhone, normalizePhone } from "@/lib/account";
import { createAdminClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";
import { createAccount } from "../dang-nhap/actions";

async function requireAdmin() {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) notFound();
  return viewer;
}

const back = (params: Record<string, string>) => `/admin?${new URLSearchParams(params)}#cap-tk`;

/**
 * Creates an account from /admin: a customer (optionally with free days) or an admin. Giving admin to a phone
 * that already has an account grants it on that account, password unchanged.
 */
export async function grantAccount(formData: FormData) {
  await requireAdmin();
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  if (!phone) redirect(back({ captk: "loi", msg: "Số điện thoại không hợp lệ." }));
  const role = formData.get("role") === "admin" ? "admin" : "customer";
  const password = String(formData.get("password") ?? "");
  // No username given: "tk" + the phone number, which always fits the username rules.
  const username = String(formData.get("username") ?? "").trim() || `tk${localPhone(phone)}`;
  const days = role === "customer" ? Math.min(3650, Math.max(0, Math.floor(Number(formData.get("days")) || 0))) : 0;

  const admin = createAdminClient();
  // Admin rights live in profiles.is_admin: check it exists before creating anything.
  if (role === "admin" && (await admin.from("profiles").select("is_admin").limit(1)).error) {
    redirect(back({ captk: "loi", msg: `Chưa cấp được quyền quản trị. ${MIGRATION_HINT}` }));
  }
  const created = await createAccount(phone, username, password);
  if (created.error) {
    const { data: existing } = await admin.from("profiles").select("id, username").eq("phone", phone).maybeSingle();
    if (role === "admin" && existing) {
      const { error } = await admin.from("profiles").update({ is_admin: true }).eq("id", existing.id);
      redirect(error ? back({ captk: "loi", msg: MIGRATION_HINT }) : back({ captk: "quyen", tk: existing.username }));
    }
    redirect(back({ captk: "loi", msg: created.error.replace(", bạn đăng nhập nhé", "").replace(", bạn chọn tên khác nhé", "") }));
  }

  const { data: profile } = await admin.from("profiles").select("id, username").eq("phone", phone).single();
  if (role === "admin") {
    const { error } = await admin.from("profiles").update({ is_admin: true }).eq("id", profile!.id);
    if (error) redirect(back({ captk: "loi", msg: `Đã tạo tài khoản ${profile!.username} nhưng chưa cấp được quyền quản trị. ${MIGRATION_HINT}` }));
  } else if (days > 0) {
    await admin.rpc("extend_subscription", { p_user: profile!.id, p_days: days });
  }
  revalidatePath("/admin");
  redirect(back({ captk: role === "admin" ? "admin" : "khach", tk: profile!.username, ...(days ? { ngay: String(days) } : {}) }));
}

const MIGRATION_HINT = "Đã chạy supabase/migrations/007_admin_accounts.sql trong Supabase chưa?";

/** Takes admin rights back from an account granted them in /admin (not from ADMIN_PHONES, nor from yourself). */
export async function revokeAdmin(formData: FormData) {
  const viewer = await requireAdmin();
  const id = String(formData.get("id"));
  if (id === viewer.id) redirect(back({ captk: "loi", msg: "Không tự thu hồi quyền của chính mình được." }));
  await createAdminClient().from("profiles").update({ is_admin: false }).eq("id", id);
  revalidatePath("/admin");
  redirect(back({ captk: "thuhoi" }));
}
