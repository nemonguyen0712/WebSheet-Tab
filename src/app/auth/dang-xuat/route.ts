import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { DEVICE_COOKIE } from "@/lib/viewer";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const deviceId = cookieStore.get(DEVICE_COOKIE)?.value;
  const supabase = await createClient();
  await Promise.allSettled([
    deviceId ? createAdminClient().from("devices").delete().eq("id", deviceId) : null,
    supabase.auth.signOut(),
  ]);
  cookieStore.delete(DEVICE_COOKIE);
  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
