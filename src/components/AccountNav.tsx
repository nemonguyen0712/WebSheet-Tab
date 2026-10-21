import Link from "next/link";
import { getViewer } from "@/lib/viewer";

export async function AccountNav() {
  const viewer = await getViewer();
  const button = "inline-flex h-9 shrink-0 items-center rounded-lg px-2.5 text-[13px] font-medium sm:px-3 sm:text-sm";
  return (
    <nav className="flex shrink-0 items-center gap-1 sm:gap-1.5">
      {viewer?.isAdmin && (
        <Link href="/admin" className={`${button} text-muted hover:text-fg`}>
          Quản trị
        </Link>
      )}
      {!viewer?.active && (
        <Link href={viewer ? "/dang-ky" : "/dang-nhap?next=/dang-ky"} className={`${button} bg-accent font-medium text-accent-fg hover:opacity-90`}>
          Đăng ký
        </Link>
      )}
      {viewer ? (
        <Link href="/tai-khoan" className={`${button} gap-1.5 border border-border bg-surface hover:border-accent`} title={viewer.username}>
          <svg viewBox="0 0 24 24" className="size-4 text-muted" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" strokeLinecap="round" />
          </svg>
          <span className="max-w-[6.5rem] truncate">{viewer.username}</span>
        </Link>
      ) : (
        <Link href="/dang-nhap" className={`${button} border border-border bg-surface hover:border-accent`}>
          Đăng nhập
        </Link>
      )}
    </nav>
  );
}
