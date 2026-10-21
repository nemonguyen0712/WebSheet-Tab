/**
 * Cheap uptime check for an external cron (e.g. cron-job.org every 10 minutes), which also keeps
 * Render's free instance from sleeping. Touches nothing: no Drive, no Supabase.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true, time: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
