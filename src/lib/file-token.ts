import { createHmac, timingSafeEqual } from "crypto";
import type { Viewer } from "./viewer";

/**
 * Short-lived file links: /api/file/<id>?t=<expiry>.<signature>, signed for one account on one
 * device. A copied link stops working after a few minutes, and never works for anyone else.
 */

const TTL_SECONDS = 5 * 60;

function signingKey() {
  // FILE_URL_SECRET if set; otherwise derived from the (secret) Supabase service key.
  const base = process.env.FILE_URL_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "dev-only-secret";
  return createHmac("sha256", base).update("file-url-v1").digest();
}

function sign(fileId: string, viewer: Viewer, exp: number) {
  return createHmac("sha256", signingKey()).update(`${fileId}.${viewer.id}.${viewer.deviceId}.${exp}`).digest("base64url");
}

export function signedFileUrl(fileId: string, viewer: Viewer) {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  return `/api/file/${encodeURIComponent(fileId)}?t=${exp}.${sign(fileId, viewer, exp)}`;
}

export function verifyFileToken(fileId: string, viewer: Viewer, token: string | null): boolean {
  const [expStr, sig] = (token ?? "").split(".");
  const exp = Number(expStr);
  if (!sig || !Number.isInteger(exp) || exp < Date.now() / 1000) return false;
  const expected = Buffer.from(sign(fileId, viewer, exp));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/**
 * Only our own pages may load files: rejects opening the link in a tab, embedding it on another
 * site, or (for browsers that send them) requests without the usual fetch metadata.
 */
export function isSameSiteSubresource(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site");
  const dest = req.headers.get("sec-fetch-dest");
  if (site || dest) return site === "same-origin" && dest !== "document" && dest !== "iframe";
  // Older browsers without Sec-Fetch-* headers: fall back to the Referer.
  const referer = req.headers.get("referer");
  return Boolean(referer && new URL(referer).origin === new URL(req.url).origin);
}
