import { getOrder, refreshOrder } from "@/lib/payments";
import { getViewer } from "@/lib/viewer";

/** Order status for the payment page to poll. Only the buyer can see their order. */
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "unauthorized" }, { status: 401 });
  const order = await getOrder(Number((await params).code));
  if (!order || order.user_id !== viewer.id) return Response.json({ error: "not found" }, { status: 404 });
  const fresh = await refreshOrder(order);
  return Response.json({ status: fresh.status }, { headers: { "cache-control": "no-store" } });
}
