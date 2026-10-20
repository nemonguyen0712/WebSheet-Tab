import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { siteUrl } from "@/lib/origin";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { MAX_DEVICES, getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Đăng nhập" };

function safePath(next: string | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

async function signInWithGoogle(formData: FormData) {
  "use server";
  const next = safePath(String(formData.get("next") ?? "/"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${await siteUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) redirect("/dang-nhap?loi=1");
  redirect(data.url);
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; loi?: string }> }) {
  const { next, loi } = await searchParams;
  const viewer = await getViewer();
  if (viewer?.deviceOk) redirect(safePath(next));

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Đăng nhập</h1>
        <p className="mt-2 text-muted">Dùng tài khoản Google, không cần tạo mật khẩu.</p>
        {viewer && !viewer.deviceOk && (
          <p className="mt-4 rounded-lg bg-accent-soft px-3 py-2 text-sm">
            Mỗi tài khoản dùng được tối đa {MAX_DEVICES} thiết bị. Đăng nhập lại ở đây sẽ đăng xuất thiết bị cũ nhất.
          </p>
        )}
        {loi && <p className="mt-4 text-sm text-red-600">Đăng nhập không thành công, bạn thử lại nhé.</p>}
        {supabaseConfigured() ? (
          <form action={signInWithGoogle} className="mt-6">
            <input type="hidden" name="next" value={safePath(next)} />
            <button
              type="submit"
              className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-border bg-white px-4 font-medium text-neutral-800 hover:border-accent"
            >
              <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7Z" />
                <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1 .7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.7-4.9h-4v3.1A12 12 0 0 0 12 24Z" />
                <path fill="#FBBC05" d="M5.3 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.9l4-3.1Z" />
                <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z" />
              </svg>
              Tiếp tục với Google
            </button>
          </form>
        ) : (
          <p className="mt-6 text-sm text-muted">
            Chưa cấu hình Supabase (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY).
          </p>
        )}
      </div>
    </main>
  );
}
