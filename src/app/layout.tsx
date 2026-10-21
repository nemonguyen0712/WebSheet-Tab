import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Bitter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import { AccountNav } from "@/components/AccountNav";
import { ContentGuard } from "@/components/ContentGuard";
import { Ambient } from "@/components/Ambient";
import { LogoMark } from "@/components/Logo";
import { SITE_NAME, ZALO_URL } from "@/lib/site";
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
  description: "Kho sheet & tab guitar solo, melody — cập nhật liên tục.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#16291d",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${beVietnam.variable} ${bitter.variable} ${jetbrains.variable}`}>
      <body className="relative isolate flex min-h-dvh flex-col font-sans antialiased">
        <Ambient />
        <div className="bg-deep text-[12.5px] text-[#c9d6cc]">
          <div className="mx-auto flex h-8 max-w-5xl items-center justify-between gap-3 px-4">
            <span className="truncate">{SITE_NAME} · Sheet & tab guitar</span>
            {ZALO_URL && (
              <a href={ZALO_URL} target="_blank" rel="noreferrer" className="shrink-0 hover:text-white">
                Hỗ trợ qua Zalo
              </a>
            )}
          </div>
        </div>
        <header className="sticky top-0 z-30 border-b border-border/70 bg-bg/75 shadow-[0_1px_0_rgb(255_255_255/0.5)] backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
            <Link href="/" className="flex min-w-0 items-center gap-2.5">
              <LogoMark className="size-9 shrink-0" />
              <span className="min-w-0 leading-none">
                <span className="block truncate font-display text-[19px] font-bold text-deep">{SITE_NAME}</span>
                <span className="mt-0.5 hidden text-[10px] font-semibold uppercase tracking-[0.2em] text-brass min-[400px]:block">
                  Sheet · Tab guitar
                </span>
              </span>
            </Link>
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
            <p>Kho sheet & tab guitar solo, melody — cập nhật liên tục.</p>
            {ZALO_URL && (
              <a href={ZALO_URL} target="_blank" rel="noreferrer" className="font-medium text-[#e9d2a8] underline underline-offset-4">
                Hỗ trợ: nhắn Zalo
              </a>
            )}
          </div>
        </footer>
        <ContentGuard />
      </body>
    </html>
  );
}
