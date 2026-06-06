import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "来信长安 | Letters from Chang'an",
  description: "你在唐朝收到了一封来自2077年的信。一款AI驱动的无限流互动叙事体验。",
  manifest: "/manifest.json",
  openGraph: {
    title: "来信长安 | Letters from Chang'an",
    description: "你在唐朝收到了一封来自2077年的信。一款AI驱动的无限流互动叙事体验。",
    images: [{ url: "/bg-changan.webp", width: 1200, height: 630 }],
    type: "website",
    locale: "zh_CN",
  },
  twitter: {
    card: "summary_large_image",
    title: "来信长安 | Letters from Chang'an",
    description: "你在唐朝收到了一封来自2077年的信。",
    images: ["/bg-changan.webp"],
  },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "来信长安",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1a1207",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className="h-full bg-stone-950 text-amber-50 overflow-hidden">
        {children}
      </body>
    </html>
  );
}
