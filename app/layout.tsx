import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LVGM SVG Demo",
  description: "Large Vector Graphics Model - SVG 展示演示",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="bg-[#fafafa]">
      <body>{children}</body>
    </html>
  );
}
