"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

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

async function signedInEmail() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, email: user?.email ?? null };
}

/** Step 1: is this the account's current password? */
export async function checkCurrentPassword(current: string): Promise<boolean> {
  const { email } = await signedInEmail();
  return Boolean(email && current && (await passwordMatches(email, current)));
}

/** Step 2: sets the new password. The current one is checked again here, on the server. */
export async function changePassword(current: string, password: string): Promise<{ error?: string }> {
  const { supabase, email } = await signedInEmail();
  if (!email) return { error: "Phiên đăng nhập đã hết, bạn đăng nhập lại nhé." };
  if (!(await passwordMatches(email, current))) return { error: "Mật khẩu hiện tại không đúng." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    // Supabase's own rule: at least 6 characters.
    return { error: error.code === "weak_password" ? "Mật khẩu cần ít nhất 6 ký tự." : "Chưa đổi được mật khẩu, bạn thử lại nhé." };
  }
  return {};
}
