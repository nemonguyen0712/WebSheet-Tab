import { purgeStaleOrders } from "@/lib/payments";
import { purgeOldViews } from "@/lib/views";

/**
 * Cheap uptime check for an external cron (e.g. cron-job.org every 10 minutes), which also keeps
 * Render's free instance from sleeping. Touches nothing: no Drive, no Supabase, no login proxy.
 *
 * `?db=1` (a second cron, once a day): also clears out old view logs and unpaid orders. That touches
 * the database, which keeps a free Supabase project from being paused after a week without requests.
 */
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store", "Content-Type": "text/plain" };

export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get("db") === "1") {
    await Promise.all([purgeOldViews(), purgeStaleOrders()]);
  }
  return new Response("ok", { headers });
}

/** HEAD: same check with no body at all. */
export function HEAD() {
  return new Response(null, { headers });
}
