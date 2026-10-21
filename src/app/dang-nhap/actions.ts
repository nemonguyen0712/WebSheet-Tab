"use server";

import { MIN_PASSWORD, USERNAME_RULES, newLoginEmail, normalizePhone, normalizeUsername } from "@/lib/account";
import { createAdminClient } from "@/lib/supabase/server";

/** Sign-up step 1: is this a valid phone number that doesn't have an account yet? */
export async function checkPhone(phoneInput: string): Promise<{ phone?: string; error?: string }> {
  const phone = normalizePhone(phoneInput);
  if (!phone) return { error: "Số điện thoại không hợp lệ." };
  const { data } = await createAdminClient().from("profiles").select("id").eq("phone", phone).maybeSingle();
  if (data) return { error: "Số điện thoại này đã có tài khoản, bạn đăng nhập nhé." };
  return { phone };
}

/**
 * Sign-up step 2: creates the account. Done on the server (service-role key) so public sign-ups
 * can stay off in Supabase and every account has a valid phone number and username.
 * Returns the login address the browser then signs in with.
 */
export async function createAccount(
  phoneInput: string,
  usernameInput: string,
  password: string,
): Promise<{ email?: string; error?: string }> {
  const phone = normalizePhone(phoneInput);
  if (!phone) return { error: "Số điện thoại không hợp lệ." };
  const username = normalizeUsername(usernameInput);
  if (!username) return { error: `Tên đăng nhập chưa hợp lệ: ${USERNAME_RULES}` };
  if (password.length < MIN_PASSWORD) return { error: `Mật khẩu cần ít nhất ${MIN_PASSWORD} ký tự.` };

  const admin = createAdminClient();
  const { data: taken } = await admin.from("profiles").select("phone, username").or(`phone.eq.${phone},username.eq.${username}`);
  if (taken?.some((p) => p.phone === phone)) return { error: "Số điện thoại này đã có tài khoản, bạn đăng nhập nhé." };
  if (taken?.some((p) => p.username === username)) return { error: "Tên đăng nhập này đã có người dùng, bạn chọn tên khác nhé." };

  const email = newLoginEmail();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) {
    console.error("createAccount", error);
    return { error: "Chưa tạo được tài khoản, bạn thử lại sau." };
  }
  const { error: profileError } = await admin.from("profiles").insert({ id: data.user.id, phone, username });
  if (profileError) {
    // Someone took the phone/username a moment ago: undo the half-created account.
    await admin.auth.admin.deleteUser(data.user.id);
    return {
      error: profileError.message.includes("username")
        ? "Tên đăng nhập này đã có người dùng, bạn chọn tên khác nhé."
        : "Số điện thoại này đã có tài khoản, bạn đăng nhập nhé.",
    };
  }
  return { email };
}

/**
 * Login: maps a username or phone number to the account's login address. Unknown names get a
 * random address, so the password check fails the same way and nothing about other accounts leaks.
 */
export async function loginEmail(identifier: string): Promise<string> {
  const admin = createAdminClient();
  const phone = normalizePhone(identifier);
  const username = phone ? null : normalizeUsername(identifier);
  const { data: profile } = phone || username
    ? await admin.from("profiles").select("id").eq(phone ? "phone" : "username", (phone ?? username)!).maybeSingle()
    : { data: null };
  if (profile) {
    const { data } = await admin.auth.admin.getUserById(profile.id);
    if (data.user?.email) return data.user.email;
  }
  return newLoginEmail();
}
