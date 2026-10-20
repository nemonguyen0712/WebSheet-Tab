import { markPaid } from "@/lib/payments";
import { payosVerifyWebhook, type PayosWebhookData } from "@/lib/payments/payos";

/** payOS calls this when a payment link is paid. Set it in payOS → Kênh thanh toán → Webhook URL. */
export async function POST(req: Request) {
  let body: { code?: string; data?: PayosWebhookData; signature?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const data = payosVerifyWebhook(body);
  if (!data) return Response.json({ error: "invalid signature" }, { status: 400 });

  // payOS sends a test payload when you save the webhook URL; it has no matching order.
  if (data.code === "00" && body.code === "00") {
    try {
      await markPaid(Number(data.orderCode), Number(data.amount), String(data.reference ?? ""));
    } catch (err) {
      console.error("payOS webhook", err);
      return Response.json({ error: "server error" }, { status: 500 });
    }
  }
  return Response.json({ success: true });
}
