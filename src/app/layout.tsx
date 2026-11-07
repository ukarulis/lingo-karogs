import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ToastProvider } from "@/lib/toast";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { AudioUnlocker } from "@/components/layout/audio-unlocker";
import "@/styles/globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  title: {
    default: "Lingo & Karogs — divas leģendāras spēles",
    template: "%s · Lingo & Karogs",
  },
  description:
    "Lingo & Karogs — divas leģendāras latviešu spēles jaunā veidolā. Atmini piecu burtu vārdus un sacenties stratēģijas spēlē ar slepenām armijām.",
  keywords: [
    "Lingo",
    "Karogs",
    "latviešu spēles",
    "vārdu spēle",
    "stratēģijas spēle",
    "Tildes Birojs",
  ],
  authors: [{ name: "Lingo & Karogs" }],
  openGraph: {
    type: "website",
    locale: "lv_LV",
    title: "Lingo & Karogs",
    description: "Divas leģendāras spēles. Jauns sākums.",
    images: siteUrl ? [{ url: "/og-image.png", width: 1200, height: 630 }] : undefined,
  },
  twitter: {
    card: "summary_large_image",
    title: "Lingo & Karogs",
    description: "Divas leģendāras spēles. Jauns sākums.",
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f6f2" },
    { media: "(prefers-color-scheme: dark)", color: "#141416" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="lv" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=JSON.parse(localStorage.getItem('lk.settings')||'{}');var t=s.theme||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light';}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ToastProvider>
          <AudioUnlocker />
          <div className="flex min-h-dvh flex-col">
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
