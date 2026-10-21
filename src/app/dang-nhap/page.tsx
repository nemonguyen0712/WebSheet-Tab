import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { supabaseConfigured } from "@/lib/supabase/server";
import { MAX_DEVICES, getViewer } from "@/lib/viewer";
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
    <main className="mx-auto max-w-md px-4 py-8">
      <Image
        src="/oliu-logo.webp"
        alt="Oliu"
        width={725}
        height={492}
        priority
        className="w-full rounded-2xl border border-[#5c4a2a] shadow-xl"
      />
      <div className="mt-4 rounded-2xl border border-border bg-surface p-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">{moi ? "Tạo tài khoản" : "Đăng nhập"}</h1>
        <p className="mt-2 text-muted">Tài khoản theo số điện thoại, không cần email.</p>
        {viewer && !viewer.deviceOk && (
          <p className="mt-4 rounded-lg bg-accent-soft px-3 py-2 text-sm">
            {MAX_DEVICES === 1
              ? "Mỗi tài khoản chỉ dùng được 1 thiết bị. Đăng nhập ở đây sẽ đăng xuất thiết bị đang dùng."
              : `Mỗi tài khoản dùng được tối đa ${MAX_DEVICES} thiết bị. Đăng nhập ở đây sẽ đăng xuất thiết bị cũ nhất.`}
          </p>
        )}
        <div className="mt-6">
          {supabaseConfigured() ? (
            <LoginForm next={safePath(next)} initialMode={moi ? "signup" : "login"} />
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
