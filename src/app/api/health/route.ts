/**
 * Cheap uptime check for an external cron (e.g. cron-job.org every 10 minutes), which also keeps
 * Render's free instance from sleeping. Touches nothing: no Drive, no Supabase, no login proxy.
 */
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store", "Content-Type": "text/plain" };

export function GET() {
  return new Response("ok", { headers });
}

/** HEAD: same check with no body at all. */
export function HEAD() {
  return new Response(null, { headers });
}
