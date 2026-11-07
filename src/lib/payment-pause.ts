/**
 * "Ngân hàng đang lỗi": a switch in /admin that pauses payments while the bank has trouble. When on, its message
 * leads the site notice (band and dialog), the plan page can't start a checkout, and the payment and donation
 * QRs say not to transfer now. Kept in Cloudflare KV (binding CACHE), so it needs no database change; KV can take up to about a minute
 * to reach every data centre, and each server process rereads it at most every PAUSE_TTL_MS.
 */

interface KV {
  get(key: string, type: "json"): Promise<unknown>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface PaymentPause {
  message: string;
  /** When it was switched on (ISO). */
  since: string;
}

export const DEFAULT_PAUSE_MESSAGE =
  "Ngân hàng đang gặp sự cố nên Oliu tạm ngưng nhận thanh toán. Bạn chưa nên chuyển khoản lúc này; tài khoản và gói đã mua vẫn dùng bình thường. Mình sẽ báo ngay khi thanh toán hoạt động lại.";

const KEY = "oliu:payment-pause";
const PAUSE_TTL_MS = 20_000;
let memo: { expires: number; value: Promise<PaymentPause | null> } | null = null;

async function kv(): Promise<KV | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    return (getCloudflareContext().env as { CACHE?: KV }).CACHE ?? null;
  } catch {
    return null;
  }
}

/** The pause, or null when payments run normally (also when KV can't be reached). */
export function getPaymentPause(): Promise<PaymentPause | null> {
  if (memo && memo.expires > Date.now()) return memo.value;
  const value = (async () => {
    try {
      const store = await kv();
      const saved = (await store?.get(KEY, "json")) as PaymentPause | null | undefined;
      return saved?.since ? { message: saved.message || DEFAULT_PAUSE_MESSAGE, since: saved.since } : null;
    } catch {
      return null;
    }
  })();
  memo = { expires: Date.now() + PAUSE_TTL_MS, value };
  return value;
}

/** Switches the pause on (with this message) or off (null). Returns false if there is no KV to keep it in. */
export async function setPaymentPause(pause: PaymentPause | null): Promise<boolean> {
  const store = await kv();
  if (!store) return false;
  if (pause) await store.put(KEY, JSON.stringify(pause));
  else await store.delete(KEY);
  memo = null;
  return true;
}
