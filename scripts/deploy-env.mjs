// Builds deploy.env from .env.local, to paste into Render → the service → Environment →
// "Add from .env". The Google key is trimmed to the two fields the site uses.
import { readFileSync, writeFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);

const raw = env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "";
const key = raw ? JSON.parse(raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8")) : null;

const provider = ["payos", "sepay"].includes(env.PAYMENT_PROVIDER) ? env.PAYMENT_PROVIDER : "manual";

const out = {
  DRIVE_FOLDER_ID: env.DRIVE_FOLDER_ID,
  GOOGLE_SERVICE_ACCOUNT_JSON: key && JSON.stringify({ client_email: key.client_email, private_key: key.private_key }),
  NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
  PAYMENT_PROVIDER: provider,
  ...(provider === "payos"
    ? {
        PAYOS_CLIENT_ID: env.PAYOS_CLIENT_ID,
        PAYOS_API_KEY: env.PAYOS_API_KEY,
        PAYOS_CHECKSUM_KEY: env.PAYOS_CHECKSUM_KEY,
      }
    : {
        // The bank account has a built-in default (src/lib/payments/index.ts); pass it on only when overridden.
        ...(env.BANK_NAME && { BANK_NAME: env.BANK_NAME }),
        ...(env.BANK_ACCOUNT_NUMBER && { BANK_ACCOUNT_NUMBER: env.BANK_ACCOUNT_NUMBER }),
        ...(env.BANK_ACCOUNT_NAME && { BANK_ACCOUNT_NAME: env.BANK_ACCOUNT_NAME }),
        ...(provider === "sepay" && { SEPAY_API_KEY: env.SEPAY_API_KEY }),
      }),
  ADMIN_PHONES: env.ADMIN_PHONES,
  NEXT_PUBLIC_ZALO: env.NEXT_PUBLIC_ZALO,
  NEXT_PUBLIC_SITE_URL: env.NEXT_PUBLIC_SITE_URL,
  MAX_DEVICES: env.MAX_DEVICES || "1",
};

const lines = [];
const missing = [];
for (const [name, value] of Object.entries(out)) {
  if (!value) {
    missing.push(name);
    continue;
  }
  lines.push(`${name}='${value}'`);
}
writeFileSync("deploy.env", lines.join("\n") + "\n");

console.log(`deploy.env: ${lines.length} biến.`);
if (missing.length) console.log(`Chưa có (điền sau trên Render): ${missing.join(", ")}`);
