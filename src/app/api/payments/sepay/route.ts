import { timingSafeEqual } from "crypto";
import { markPaid, parseTransferNote } from "@/lib/payments";

interface SepayTransaction {
  id: number;
  transferType: "in" | "out";
  transferAmount: number;
  content: string | null;
  code: string | null;
  referenceCode: string | null;
}

function authorized(req: Request) {
  const key = process.env.SEPAY_API_KEY;
  if (!key) return false;
  const expected = Buffer.from(`Apikey ${key}`);
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/**
 * SePay calls this for every transaction on the linked bank account.
 * Set it in SePay → Webhooks, with authentication "API Key" = SEPAY_API_KEY.
 */
export async function POST(req: Request) {
  if (!authorized(req)) return Response.json({ success: false }, { status: 401 });

  let tx: SepayTransaction;
  try {
    tx = await req.json();
  } catch {
    return Response.json({ success: false }, { status: 400 });
  }
  if (tx.transferType !== "in") return Response.json({ success: true });

  const orderCode = parseTransferNote(`${tx.code ?? ""} ${tx.content ?? ""}`);
  if (orderCode) {
    try {
      await markPaid(orderCode, Number(tx.transferAmount), `sepay:${tx.id}:${tx.referenceCode ?? ""}`);
    } catch (err) {
      console.error("SePay webhook", err);
      return Response.json({ success: false }, { status: 500 });
    }
  }
  return Response.json({ success: true });
}
