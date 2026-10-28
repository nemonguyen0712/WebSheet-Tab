import { createAdminClient } from "./supabase/server";

/**
 * Song requests (table song_requests, supabase/migrations/005): a paying customer asks for a song to be added.
 * Each account gets SONG_REQUESTS_PER_MONTH per calendar month (Vietnam time); a rejected request doesn't count,
 * so it is given back.
 */
export const SONG_REQUESTS_PER_MONTH = Number(process.env.SONG_REQUESTS_PER_MONTH) || 2;

export type RequestStatus = "pending" | "done" | "rejected";

export interface SongRequest {
  id: number;
  user_id: string;
  title: string;
  section: "" | "solo" | "melody";
  detail: string;
  status: RequestStatus;
  admin_note: string;
  created_at: string;
  updated_at: string;
}

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  pending: "Đang chờ",
  done: "Đã có bài",
  rejected: "Từ chối",
};

/** Midnight on the 1st of this month in Vietnam (UTC+7, no daylight saving), as an ISO time. */
export function monthStartVN(now = Date.now()): string {
  const vn = new Date(now + 7 * 3_600_000);
  return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), 1) - 7 * 3_600_000).toISOString();
}

/** Midnight today in Vietnam, as an ISO time. */
export function dayStartVN(now = Date.now()): string {
  const vn = new Date(now + 7 * 3_600_000);
  return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()) - 7 * 3_600_000).toISOString();
}

/**
 * Requests this account may still send this month; null when the table doesn't exist yet (migration not run).
 * Rejected ones don't count.
 */
export async function requestsLeft(userId: string): Promise<number | null> {
  const { count, error } = await createAdminClient()
    .from("song_requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .neq("status", "rejected")
    .gte("created_at", monthStartVN());
  // A count-only query on a missing table comes back without an error, just no count.
  if (error || count === null) return null;
  return Math.max(0, SONG_REQUESTS_PER_MONTH - count);
}
