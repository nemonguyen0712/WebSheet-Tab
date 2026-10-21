// Builds netlify.env from .env.local for Netlify → Site configuration → Environment variables →
// "Import from a .env file". Netlify functions run on AWS Lambda, which allows only ~4 KB of
// environment variables in total, so the Google key is trimmed to the two fields we use.
import { readFileSync, writeFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);

const raw = env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "";
const key = raw ? JSON.parse(raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8")) : null;

const provider = env.PAYMENT_PROVIDER === "sepay" ? "sepay" : "payos";

const out = {
  DRIVE_FOLDER_ID: env.DRIVE_FOLDER_ID,
  GOOGLE_SERVICE_ACCOUNT_JSON: key && JSON.stringify({ client_email: key.client_email, private_key: key.private_key }),
  NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
  PAYMENT_PROVIDER: provider,
  ...(provider === "sepay"
    ? {
        SEPAY_API_KEY: env.SEPAY_API_KEY,
        SEPAY_BANK: env.SEPAY_BANK,
        SEPAY_ACCOUNT_NUMBER: env.SEPAY_ACCOUNT_NUMBER,
        SEPAY_ACCOUNT_NAME: env.SEPAY_ACCOUNT_NAME,
      }
    : {
        PAYOS_CLIENT_ID: env.PAYOS_CLIENT_ID,
        PAYOS_API_KEY: env.PAYOS_API_KEY,
        PAYOS_CHECKSUM_KEY: env.PAYOS_CHECKSUM_KEY,
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
writeFileSync("netlify.env", lines.join("\n") + "\n");

const bytes = Object.entries(out).reduce((n, [k, v]) => n + (v ? k.length + v.length : 0), 0);
console.log(`netlify.env: ${lines.length} biến, khoảng ${bytes} byte (giới hạn của Netlify ~4096).`);
if (bytes > 3800) console.log("⚠ Gần chạm giới hạn 4KB của Netlify.");
if (missing.length) console.log(`Chưa có (điền sau trên Netlify): ${missing.join(", ")}`);
