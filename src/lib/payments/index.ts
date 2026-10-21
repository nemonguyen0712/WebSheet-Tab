import { siteUrl } from "../origin";
import { createAdminClient, supabaseConfigured } from "../supabase/server";
import { payosCreateLink, payosGetLink } from "./payos";
import type { Plan } from "../plans";

/**
 * Payment providers:
 * - "payos": payOS hosted checkout page with VietQR; payOS calls /api/payments/payos when paid.
 * - "sepay": our own page shows a VietQR for your bank account; SePay watches the account and
 *   calls /api/payments/sepay when a transfer with the order code arrives.
 */
export type Provider = "payos" | "sepay";

export function paymentProvider(): Provider {
  return process.env.PAYMENT_PROVIDER === "sepay" ? "sepay" : "payos";
}

/** Transfer note for an order; short because some banks cut notes at 9 characters. */
export function transferNote(orderCode: number) {
  return `TAB${orderCode}`;
}

export function parseTransferNote(text: string): number | null {
  const m = /TAB\s?(\d{6,})/i.exec(text);
  return m ? Number(m[1]) : null;
}

export interface Order {
  order_code: number;
  user_id: string;
  plan: string;
  days: number;
  amount: number;
  provider: Provider;
  status: "pending" | "paid" | "cancelled";
  checkout_url: string | null;
  created_at: string;
  paid_at: string | null;
}

/** Creates an order and returns where to send the buyer to pay. */
export async function startCheckout(user: { id: string; phone: string }, plan: Plan): Promise<string> {
  const provider = paymentProvider();
  const admin = createAdminClient();
  const { data: order, error } = await admin
    .from("orders")
    .insert({ user_id: user.id, plan: plan.id, days: plan.days, amount: plan.price, provider })
    .select("order_code")
    .single();
  if (error) throw error;
  const orderCode = Number(order.order_code);
  const resultUrl = `${await siteUrl()}/thanh-toan/${orderCode}`;

  if (provider === "payos") {
    const { checkoutUrl } = await payosCreateLink({
      orderCode,
      amount: plan.price,
      description: transferNote(orderCode),
      returnUrl: resultUrl,
      cancelUrl: `${resultUrl}?huy=1`,
      buyerPhone: "0" + user.phone.slice(2),
    });
    await admin.from("orders").update({ checkout_url: checkoutUrl }).eq("order_code", orderCode);
    return checkoutUrl;
  }
  return resultUrl;
}

/** Marks an order paid and extends the subscription. Idempotent. */
export async function markPaid(orderCode: number, amount: number, ref: string): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("mark_order_paid", {
    p_order_code: orderCode,
    p_amount: amount,
    p_ref: ref,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function getOrder(orderCode: number): Promise<Order | null> {
  if (!supabaseConfigured() || !Number.isSafeInteger(orderCode)) return null;
  const { data } = await createAdminClient().from("orders").select("*").eq("order_code", orderCode).maybeSingle();
  return (data as Order | null) ?? null;
}

/**
 * Checks with payOS directly whether a pending order was paid — covers a webhook that is
 * late or misconfigured. Returns the up-to-date order.
 */
export async function refreshOrder(order: Order): Promise<Order> {
  if (order.status !== "pending" || order.provider !== "payos") return order;
  try {
    const link = await payosGetLink(order.order_code);
    if (link.status === "PAID") {
      await markPaid(order.order_code, link.amountPaid, link.id);
      return { ...order, status: "paid" };
    }
    if (link.status === "CANCELLED" || link.status === "EXPIRED") {
      await createAdminClient().from("orders").update({ status: "cancelled" }).eq("order_code", order.order_code).eq("status", "pending");
      return { ...order, status: "cancelled" };
    }
  } catch (err) {
    console.error(err);
  }
  return order;
}

/** VietQR image for SePay mode (bank + account from env). */
export function sepayQrUrl(order: Pick<Order, "order_code" | "amount">) {
  const params = new URLSearchParams({
    acc: process.env.SEPAY_ACCOUNT_NUMBER ?? "",
    bank: process.env.SEPAY_BANK ?? "",
    amount: String(order.amount),
    des: transferNote(order.order_code),
  });
  return `https://qr.sepay.vn/img?${params}`;
}
