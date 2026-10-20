import { cookies } from "next/headers";
import { cache } from "react";
import { createAdminClient, createClient, supabaseConfigured } from "./supabase/server";

export const DEVICE_COOKIE = "tab_device";
/** How many devices one account may be signed in on at once. */
export const MAX_DEVICES = Number(process.env.MAX_DEVICES) || 2;

export interface Viewer {
  id: string;
  email: string;
  paidUntil: string | null;
  /** Signed in on this device (not pushed out by logging in on too many others). */
  deviceOk: boolean;
  /** Can see full sheets/tabs. */
  active: boolean;
  isAdmin: boolean;
}

function isAdminEmail(email: string) {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .includes(email.toLowerCase());
}

/**
 * Local development without Supabase: DEV_VIEWER=free|paid|admin fakes a signed-in visitor
 * so the paywall and full views can be checked. Ignored in production.
 */
function devViewer(): Viewer | null | undefined {
  const mode = process.env.NODE_ENV === "development" ? process.env.DEV_VIEWER : undefined;
  if (!mode) return undefined;
  if (mode === "none") return null;
  const paid = mode === "paid" || mode === "admin";
  return {
    id: "00000000-0000-0000-0000-000000000000",
    email: "dev@example.com",
    paidUntil: paid ? new Date(Date.now() + 30 * 86_400_000).toISOString() : null,
    deviceOk: true,
    active: paid,
    isAdmin: mode === "admin",
  };
}

/** The signed-in visitor and their subscription, or null when signed out. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  // Read cookies first so every page that shows login state renders per request.
  const cookieStore = await cookies();
  const dev = devViewer();
  if (dev !== undefined) return dev;
  if (!supabaseConfigured()) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const admin = createAdminClient();
  const deviceId = cookieStore.get(DEVICE_COOKIE)?.value;
  const [{ data: profile }, { data: device }] = await Promise.all([
    admin.from("profiles").select("paid_until").eq("id", user.id).maybeSingle(),
    deviceId
      ? admin.from("devices").select("id, last_seen").eq("id", deviceId).eq("user_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Record activity at most every 10 minutes.
  if (device && Date.now() - Date.parse(device.last_seen) > 10 * 60_000) {
    await admin.from("devices").update({ last_seen: new Date().toISOString() }).eq("id", device.id);
  }

  const paidUntil: string | null = profile?.paid_until ?? null;
  const deviceOk = Boolean(device);
  return {
    id: user.id,
    email: user.email,
    paidUntil,
    deviceOk,
    active: deviceOk && paidUntil !== null && Date.parse(paidUntil) > Date.now(),
    isAdmin: isAdminEmail(user.email),
  };
});

/**
 * Registers this browser as one of the account's devices, signing out the oldest ones
 * beyond MAX_DEVICES. Returns the device id to store in the DEVICE_COOKIE.
 */
export async function registerDevice(userId: string, email: string, userAgent: string): Promise<string> {
  const admin = createAdminClient();
  await admin.from("profiles").upsert({ id: userId, email }, { onConflict: "id", ignoreDuplicates: true });
  const { data: device, error } = await admin
    .from("devices")
    .insert({ user_id: userId, user_agent: userAgent.slice(0, 300) })
    .select("id")
    .single();
  if (error) throw error;

  const { data: all } = await admin
    .from("devices")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  const extra = (all ?? []).slice(MAX_DEVICES).map((d) => d.id);
  if (extra.length) await admin.from("devices").delete().in("id", extra);
  return device.id;
}
