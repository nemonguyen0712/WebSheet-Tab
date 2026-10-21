/**
 * Accounts sign in with a username or phone number plus a password. Supabase signs users in
 * by email, so each account gets a random placeholder address (no mail is ever sent to it);
 * the username and phone live in public.profiles and are looked up on the server.
 */

const LOGIN_EMAIL_DOMAIN = "tk.khotab.local";

export function newLoginEmail() {
  return `${crypto.randomUUID()}@${LOGIN_EMAIL_DOMAIN}`;
}

/** "0901 234 567", "+84 90-123-4567", "84901234567" → "84901234567"; null if not a VN mobile number. */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/[\s.\-()]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("0")) digits = "84" + digits.slice(1);
  return /^84[35789]\d{8}$/.test(digits) ? digits : null;
}

/** "84901234567" → "0901 234 567" */
export function formatPhone(phone: string) {
  const local = phone.startsWith("84") ? "0" + phone.slice(2) : phone;
  return local.replace(/^(\d{4})(\d{3})(\d+)$/, "$1 $2 $3");
}

/** Supabase's own minimum; any characters are allowed. */
export const MIN_PASSWORD = 6;

/** 3–20 lowercase letters, digits, "." or "_", with at least one letter (so it can't look like a phone number). */
const USERNAME_RE = /^(?=.*[a-z])[a-z0-9._]{3,20}$/;

export function normalizeUsername(input: string): string | null {
  const name = input.trim().toLowerCase();
  return USERNAME_RE.test(name) ? name : null;
}

export const USERNAME_RULES = "3–20 ký tự, gồm chữ không dấu, số, dấu chấm hoặc gạch dưới, có ít nhất một chữ cái.";
