import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "来信长安 | Letters from Chang'an",
  description: "你有一封跨越千年的信。一款AI驱动的无限流互动叙事体验。",
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
