import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import { AccountNav } from "@/components/AccountNav";
import { ContentGuard } from "@/components/ContentGuard";
import { SITE_NAME, ZALO_URL } from "@/lib/site";
import "./globals.css";

const beVietnam = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-be-vietnam",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin", "vietnamese"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: "Kho lưu trữ tab, sheet và hợp âm guitar.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${beVietnam.variable} ${jetbrains.variable}`}>
      <body className="flex min-h-dvh flex-col font-sans antialiased">
        <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
            <Link href="/" className="flex min-w-0 items-center gap-2 font-bold tracking-tight">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-fg">
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <path d="M4 7h16M4 10h16M4 13h16M4 16h16" strokeLinecap="round" />
                  <circle cx="9" cy="10" r="1.6" fill="currentColor" stroke="none" />
                  <circle cx="14" cy="13" r="1.6" fill="currentColor" stroke="none" />
                  <circle cx="11" cy="16" r="1.6" fill="currentColor" stroke="none" />
                </svg>
              </span>
              <span className="truncate text-[15px] sm:text-base">{SITE_NAME}</span>
            </Link>
            <AccountNav />
          </div>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="border-t border-border bg-surface px-4 py-6 text-center text-sm text-muted">
          {SITE_NAME}
          {ZALO_URL && (
            <>
              {" · Hỗ trợ: "}
              <a href={ZALO_URL} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-4">
                Nhắn Zalo
              </a>
            </>
          )}
        </footer>
        <ContentGuard />
      </body>
    </html>
  );
}
