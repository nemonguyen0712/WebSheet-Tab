import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEVICE_COOKIE, registerDevice } from "@/lib/viewer";

/** Called by the login form right after signing in: registers this browser as one of the account's devices. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const deviceId = await registerDevice(user.id, req.headers.get("user-agent") ?? "");
  const res = NextResponse.json({ ok: true });
  res.cookies.set(DEVICE_COOKIE, deviceId, {
    httpOnly: true,
    secure: new URL(req.url).protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
