import { localPhone } from "../account";
import { siteUrl } from "../origin";
import { createAdminClient, supabaseConfigured } from "../supabase/server";
import { payosCreateLink, payosGetLink } from "./payos";
import type { Plan } from "../plans";

/**
 * Payment providers:
 * - "payos": payOS hosted checkout page with VietQR; payOS calls /api/payments/payos when paid.
 * - "sepay": our own page shows a VietQR for your bank account; SePay watches the account and
 *   calls /api/payments/sepay when a transfer with the order code arrives.
 * - "manual" (default): the same VietQR page, with the buyer's phone number as the transfer note;
 *   you match the transfer in your bank app and confirm the order yourself in /admin.
 */
export type Provider = "payos" | "sepay" | "manual";

export function paymentProvider(): Provider {
  const p = process.env.PAYMENT_PROVIDER;
  return p === "payos" || p === "sepay" ? p : "manual";
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

/**
 * Returns where to send the buyer to pay. A buyer has at most one unpaid order: buying again
 * reopens it instead of creating another, so /admin never shows duplicates to match against.
 */
export async function startCheckout(user: { id: string; phone: string }, plan: Plan): Promise<string> {
  const provider = paymentProvider();
  const admin = createAdminClient();

  const { data: pending } = await admin
    .from("orders")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  for (const old of (pending ?? []) as Order[]) {
    const fresh = await refreshOrder(old);
    if (fresh.status !== "pending") continue;
    const reusable = fresh.provider === provider && fresh.plan === plan.id && fresh.amount === plan.price;
    if (reusable && provider !== "payos") return `${await siteUrl()}/thanh-toan/${fresh.order_code}`;
    if (reusable && fresh.checkout_url) return fresh.checkout_url;
    // Left over from another payment mode or an old price. A manual one stays open (the money may
    // already be in the bank, waiting for you to confirm); an automatic one unpaid by now is dead.
    if (fresh.provider !== "manual") {
      await admin.from("orders").update({ status: "cancelled" }).eq("order_code", fresh.order_code).eq("status", "pending");
    }
  }

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
      buyerPhone: localPhone(user.phone),
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

/** The buyer's open order, if any (shown on the pricing page as "continue paying"). */
export async function getPendingOrder(userId: string): Promise<Order | null> {
  if (!supabaseConfigured()) return null;
  const { data } = await createAdminClient()
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Order | null) ?? null;
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

/**
 * The bank account buyers pay into (manual and SePay modes): VietinBank 0908928517, Huỳnh Nhật Anh.
 * BANK_NAME / BANK_ACCOUNT_NUMBER / BANK_ACCOUNT_NAME override it.
 */
export function bankAccount() {
  return {
    bank: process.env.BANK_NAME || "VietinBank",
    number: process.env.BANK_ACCOUNT_NUMBER || "0908928517",
    name: process.env.BANK_ACCOUNT_NAME || "HUYNH NHAT ANH",
  };
}

/**
 * What the buyer writes in the transfer: the order code in SePay mode (SePay matches it automatically),
 * the buyer's own phone number in manual mode (easy to spot in the bank app and look up in /admin).
 */
export function bankTransferNote(order: Pick<Order, "order_code" | "provider">, buyerPhone: string) {
  return order.provider === "manual" ? localPhone(buyerPhone) : transferNote(order.order_code);
}

/**
 * VietQR as a "bank card" style image (VietQR, napas 247 and bank logos, account holder, account
 * number) whose QR already contains the amount and the transfer note, so customers just scan and confirm.
 */
export function bankQrUrl(amount: number, note: string) {
  const { bank, number, name } = bankAccount();
  const params = new URLSearchParams({ amount: String(amount), addInfo: note, accountName: name });
  return `https://img.vietqr.io/image/${encodeURIComponent(bank)}-${encodeURIComponent(number)}-print.png?${params}`;
}
