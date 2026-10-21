import Link from "next/link";
import { getViewer } from "@/lib/viewer";

export async function AccountNav() {
  const viewer = await getViewer();
  const button = "inline-flex h-9 items-center rounded-lg px-3 text-sm";
  return (
    <nav className="ml-auto flex items-center gap-1.5">
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
        <Link href="/tai-khoan" className={`${button} border border-border hover:border-accent`} title={viewer.username}>
          {viewer.username}
        </Link>
      ) : (
        <Link href="/dang-nhap" className={`${button} border border-border hover:border-accent`}>
          Đăng nhập
        </Link>
      )}
    </nav>
  );
}
