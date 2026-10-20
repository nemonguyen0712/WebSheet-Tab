import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import { AccountNav } from "@/components/AccountNav";
import { SITE_NAME } from "@/lib/site";
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f4ef" },
    { media: "(prefers-color-scheme: dark)", color: "#15120f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${beVietnam.variable} ${jetbrains.variable}`}>
      <body className="min-h-dvh font-sans antialiased">
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <svg viewBox="0 0 24 24" className="size-6 text-accent" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <path d="M4 7h16M4 10h16M4 13h16M4 16h16" strokeLinecap="round" />
                <circle cx="9" cy="10" r="1.6" fill="currentColor" stroke="none" />
                <circle cx="14" cy="13" r="1.6" fill="currentColor" stroke="none" />
                <circle cx="11" cy="16" r="1.6" fill="currentColor" stroke="none" />
              </svg>
              <span className="hidden min-[380px]:inline">{SITE_NAME}</span>
            </Link>
            <AccountNav />
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
