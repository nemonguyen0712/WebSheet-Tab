import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

/** Keeps the Supabase login session fresh by refreshing its cookies on each page request. */
export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  let response = NextResponse.next({ request: { headers: requestHeaders } });
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return response;

  // FAST PATH: If no Supabase auth cookie exists, skip querying Supabase Auth (~1s saved for visitors)
  const hasAuth = request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));
  if (!hasAuth) return response;

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request: { headers: requestHeaders } });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    requestHeaders.set("x-user-id", user.id);
  }
  return response;
}

export const config = {
  // Skip static assets, payment webhooks (which come from payOS/SePay, not a browser) and the cron's health check.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|pdfjs/|alphatab/|api/payments/|api/health|.*\\.(?:png|jpg|svg|webp)$).*)"],
};
