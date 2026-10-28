import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Bitter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import { AccountNav } from "@/components/AccountNav";
import { ContentGuard } from "@/components/ContentGuard";
import { Ambient } from "@/components/Ambient";
import { LogoMark } from "@/components/Logo";
import { SiteNotice, SiteNoticeDialog } from "@/components/SiteNotice";
import { SITE_NAME, zalo } from "@/lib/site";
import "./globals.css";

const beVietnam = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-be-vietnam",
});

const bitter = Bitter({
  subsets: ["latin", "vietnamese"],
  weight: ["600", "700"],
  variable: "--font-bitter",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin", "vietnamese"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: "Kho sheet guitar solo, melody — cập nhật liên tục.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#16291d",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const support = zalo();
  return (
    <html lang="vi" className={`${beVietnam.variable} ${bitter.variable} ${jetbrains.variable}`}>
      <body className="relative isolate flex min-h-dvh flex-col font-sans antialiased">
        <Ambient />
        <header className="sticky top-0 z-30 border-b border-border/70 bg-bg/75 shadow-[0_1px_0_rgb(255_255_255/0.5)] backdrop-blur-md">
          <SiteNotice />
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
            <Link href="/" className="flex min-w-0 items-center gap-2.5">
              <LogoMark className="size-9 shrink-0" />
              <span className="truncate font-display text-[21px] font-bold leading-none text-deep">{SITE_NAME}</span>
            </Link>
            {/* Zalo support (used to sit in a separate strip above the header). */}
            <a
              href={support.url}
              target="_blank"
              rel="noreferrer"
              className="ml-auto inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium text-[#0068ff] hover:bg-surface/70 sm:text-sm"
              title={`Hỗ trợ qua Zalo: ${support.display}`}
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" strokeLinejoin="round" />
              </svg>
              <span className="sm:hidden">Zalo</span>
              <span className="hidden sm:inline">Hỗ trợ Zalo: {support.display}</span>
            </a>
            <AccountNav />
          </div>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="bg-deep px-4 py-8 text-sm text-[#b9c7bc]">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 text-center">
            <div className="flex items-center gap-2">
              <LogoMark className="size-7" />
              <span className="font-display text-base font-bold text-[#f5f1e6]">{SITE_NAME}</span>
            </div>
            <p>Kho sheet guitar solo, melody — cập nhật liên tục.</p>
            <a href={support.url} target="_blank" rel="noreferrer" className="font-medium text-[#e9d2a8] underline underline-offset-4">
              Hỗ trợ: nhắn Zalo {support.display}
            </a>
          </div>
        </footer>
        <ContentGuard />
        <SiteNoticeDialog />
      </body>
    </html>
  );
}
