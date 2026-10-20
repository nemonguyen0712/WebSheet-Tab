import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { DEVICE_COOKIE } from "@/lib/viewer";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const deviceId = cookieStore.get(DEVICE_COOKIE)?.value;
  if (deviceId) await createAdminClient().from("devices").delete().eq("id", deviceId);
  const supabase = await createClient();
  await supabase.auth.signOut();
  cookieStore.delete(DEVICE_COOKIE);
  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
