import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEVICE_COOKIE, registerDevice } from "@/lib/viewer";

/** Google sends the visitor back here after signing in. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user?.email) {
      const deviceId = await registerDevice(data.user.id, data.user.email, req.headers.get("user-agent") ?? "");
      const res = NextResponse.redirect(new URL(safeNext, url.origin));
      res.cookies.set(DEVICE_COOKIE, deviceId, {
        httpOnly: true,
        secure: url.protocol === "https:",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
      return res;
    }
    console.error("auth callback", error);
  }
  return NextResponse.redirect(new URL("/dang-nhap?loi=1", url.origin));
}
