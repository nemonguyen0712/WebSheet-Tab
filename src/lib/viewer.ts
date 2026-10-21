import { cookies } from "next/headers";
import { cache } from "react";
import { normalizePhone } from "./account";
import { createAdminClient, createClient, supabaseConfigured } from "./supabase/server";

export const DEVICE_COOKIE = "tab_device";
/** How many devices one account may be signed in on at once. */
export const MAX_DEVICES = Number(process.env.MAX_DEVICES) || 1;

export interface Viewer {
  id: string;
  username: string;
  /** Normalized phone number, e.g. "84901234567". */
  phone: string;
  paidUntil: string | null;
  /** Signed in on this device (not pushed out by logging in on too many others). */
  deviceOk: boolean;
  deviceId: string | null;
  /** Can see full sheets/tabs. */
  active: boolean;
  isAdmin: boolean;
}

function isAdminPhone(phone: string) {
  // Tolerates quotes pasted along with the value (deploy.env writes ADMIN_PHONES='0901…').
  return (process.env.ADMIN_PHONES ?? "")
    .replace(/["']/g, "")
    .split(/[,;]/)
    .map((p) => normalizePhone(p))
    .includes(phone);
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
    username: "dev",
    phone: "84900000000",
    paidUntil: paid ? new Date(Date.now() + 30 * 86_400_000).toISOString() : null,
    deviceOk: true,
    deviceId: "dev",
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
  if (!user) return null;

  const admin = createAdminClient();
  const deviceId = cookieStore.get(DEVICE_COOKIE)?.value;
  const [{ data: profile }, { data: device }] = await Promise.all([
    admin.from("profiles").select("username, phone, paid_until").eq("id", user.id).maybeSingle(),
    deviceId
      ? admin.from("devices").select("id, last_seen").eq("id", deviceId).eq("user_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Record activity at most every 10 minutes.
  if (device && Date.now() - Date.parse(device.last_seen) > 10 * 60_000) {
    await admin.from("devices").update({ last_seen: new Date().toISOString() }).eq("id", device.id);
  }

  if (!profile) return null;
  const paidUntil: string | null = profile.paid_until;
  const deviceOk = Boolean(device);
  const isAdmin = isAdminPhone(profile.phone);
  return {
    id: user.id,
    username: profile.username,
    phone: profile.phone,
    paidUntil,
    deviceOk,
    deviceId: device?.id ?? null,
    // Admins see everything without buying a plan.
    active: deviceOk && (isAdmin || (paidUntil !== null && Date.parse(paidUntil) > Date.now())),
    isAdmin,
  };
});

/**
 * Registers this browser as one of the account's devices, signing out the oldest ones
 * beyond MAX_DEVICES. Returns the device id to store in the DEVICE_COOKIE.
 */
export async function registerDevice(userId: string, userAgent: string): Promise<string> {
  const admin = createAdminClient();
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
