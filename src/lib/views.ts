import { createAdminClient, supabaseConfigured } from "./supabase/server";
import type { Viewer } from "./viewer";

/** Different files one account may open per hour (re-opening the same file doesn't count). */
export const FILE_VIEW_LIMIT_PER_HOUR = Number(process.env.FILE_VIEW_LIMIT_PER_HOUR) || 60;

/**
 * How long views are kept. The hourly limit needs one hour and /admin's "most viewed" one day; a month
 * leaves room to look into an account, while keeping the log from growing for ever (it's the one table
 * that grows with every sheet opened).
 */
const VIEW_LOG_DAYS = 30;

export async function purgeOldViews() {
  if (!supabaseConfigured()) return;
  const before = new Date(Date.now() - VIEW_LOG_DAYS * 86_400_000).toISOString();
  const { error } = await createAdminClient().from("file_views").delete().lt("created_at", before);
  if (error) console.error("purgeOldViews", error.message);
}

/**
 * Logs a full-file view and enforces the hourly limit. Returns false when the account is over it.
 * Admins are logged but never limited. If the log can't be read, viewing is allowed.
 */
export async function recordFileView(viewer: Viewer, fileId: string): Promise<boolean> {
  if (!supabaseConfigured() || viewer.deviceId === "dev") return true;
  const admin = createAdminClient();

  if (!viewer.isAdmin) {
    const since = new Date(Date.now() - 3_600_000).toISOString();
    const { data, error } = await admin
      .from("file_views")
      .select("file_id")
      .eq("user_id", viewer.id)
      .gte("created_at", since)
      .limit(1000);
    if (!error && data) {
      const files = new Set(data.map((v) => v.file_id));
      if (!files.has(fileId) && files.size >= FILE_VIEW_LIMIT_PER_HOUR) return false;
    }
  }

  const { error } = await admin.from("file_views").insert({ user_id: viewer.id, file_id: fileId });
  if (error) console.error("recordFileView", error.message);
  return true;
}
