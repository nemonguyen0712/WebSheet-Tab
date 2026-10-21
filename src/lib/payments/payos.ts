import { createHmac, timingSafeEqual } from "crypto";

/** Minimal payOS client (https://payos.vn), following the signing rules of the official SDK. */

const BASE_URL = "https://api-merchant.payos.vn";

function config() {
  const clientId = process.env.PAYOS_CLIENT_ID;
  const apiKey = process.env.PAYOS_API_KEY;
  const checksumKey = process.env.PAYOS_CHECKSUM_KEY;
  if (!clientId || !apiKey || !checksumKey) throw new Error("Chưa cấu hình PAYOS_CLIENT_ID / PAYOS_API_KEY / PAYOS_CHECKSUM_KEY");
  return { clientId, apiKey, checksumKey };
}

function hmac(key: string, data: string) {
  return createHmac("sha256", key).update(data).digest("hex");
}

/** Webhook signature: keys sorted, "key=value" joined by "&", null → "", arrays as JSON. */
function signObject(data: Record<string, unknown>, key: string) {
  const str = Object.keys(data)
    .sort()
    .filter((k) => data[k] !== undefined)
    .map((k) => {
      let v = data[k];
      if (Array.isArray(v)) {
        v = JSON.stringify(
          v.map((item: Record<string, unknown>) =>
            Object.fromEntries(Object.keys(item).sort().map((ik) => [ik, item[ik]])),
          ),
        );
      }
      if (v === null || v === undefined || v === "null" || v === "undefined") v = "";
      return `${k}=${v}`;
    })
    .join("&");
  return hmac(key, str);
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { clientId, apiKey } = config();
  const res = await fetch(BASE_URL + path, {
    ...init,
    headers: { "x-client-id": clientId, "x-api-key": apiKey, "content-type": "application/json" },
    cache: "no-store",
  });
  const json = (await res.json()) as { code: string; desc: string; data: T | null };
  if (json.code !== "00" || !json.data) throw new Error(`payOS: ${json.desc} (${json.code})`);
  return json.data;
}

export async function payosCreateLink(order: {
  orderCode: number;
  amount: number;
  description: string;
  returnUrl: string;
  cancelUrl: string;
  buyerPhone?: string;
}): Promise<{ checkoutUrl: string }> {
  const { checksumKey } = config();
  const { amount, cancelUrl, description, orderCode, returnUrl } = order;
  const signature = hmac(
    checksumKey,
    `amount=${amount}&cancelUrl=${cancelUrl}&description=${description}&orderCode=${orderCode}&returnUrl=${returnUrl}`,
  );
  return call("/v2/payment-requests", { method: "POST", body: JSON.stringify({ ...order, signature }) });
}

export type PayosStatus = "PENDING" | "CANCELLED" | "UNDERPAID" | "PAID" | "EXPIRED" | "PROCESSING" | "FAILED";

export async function payosGetLink(orderCode: number) {
  return call<{ orderCode: number; amount: number; amountPaid: number; status: PayosStatus; id: string }>(
    `/v2/payment-requests/${orderCode}`,
  );
}

export interface PayosWebhookData {
  orderCode: number;
  amount: number;
  code: string;
  reference: string;
  [key: string]: unknown;
}

/** Returns the webhook data if its signature is valid, otherwise null. */
export function payosVerifyWebhook(body: { data?: PayosWebhookData; signature?: string }): PayosWebhookData | null {
  if (!body.data || !body.signature) return null;
  const expected = Buffer.from(signObject(body.data, config().checksumKey));
  const given = Buffer.from(body.signature);
  return expected.length === given.length && timingSafeEqual(expected, given) ? body.data : null;
}
