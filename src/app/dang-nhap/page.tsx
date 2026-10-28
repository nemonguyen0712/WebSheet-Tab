import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { supabaseConfigured } from "@/lib/supabase/server";
import { MAX_DEVICES, getViewer } from "@/lib/viewer";
import { zalo } from "@/lib/site";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Đăng nhập" };

function safePath(next: string | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; moi?: string }> }) {
  const { next, moi } = await searchParams;
  const viewer = await getViewer();
  if (viewer?.deviceOk) redirect(safePath(next));

  return (
    // Starts just below the OLIU wordmark of the background photo (see .below-backdrop-logo). A fixed,
    // one-screen page (see .auth-screen): the panel stays compact and scrolls inside itself if a phone is too short.
    <main className="below-backdrop-logo auth-screen mx-auto h-full max-w-sm px-4 pb-2">
      <div className="oliu-dark max-h-full overflow-y-auto rounded-2xl border border-border bg-surface p-3 text-center shadow-2xl backdrop-blur-md">
        {/* The Đăng nhập / Tạo tài khoản tabs already say it; the heading stays for screen readers. */}
        <h1 className="sr-only">{moi ? "Tạo tài khoản" : "Đăng nhập"}</h1>
        {viewer && !viewer.deviceOk && (
          <p className="mb-3 rounded-lg bg-accent-soft px-3 py-2 text-sm">
            {MAX_DEVICES === 1
              ? "Mỗi tài khoản chỉ dùng được 1 thiết bị. Đăng nhập ở đây sẽ đăng xuất thiết bị đang dùng."
              : `Mỗi tài khoản dùng được tối đa ${MAX_DEVICES} thiết bị. Đăng nhập ở đây sẽ đăng xuất thiết bị cũ nhất.`}
          </p>
        )}
        <div>
          {supabaseConfigured() ? (
            <LoginForm next={safePath(next)} initialMode={moi ? "signup" : "login"} zaloUrl={zalo().url} />
          ) : (
            <p className="text-sm text-muted">
              Chưa cấu hình Supabase (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY).
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
