import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LVGM — 面向多风格的视觉引导式矢量字形大模型",
  description: "Large Vector Graphics Model for Style-Guided Chinese Glyph Generation. arXiv 2024.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="bg-background">
      <body>{children}</body>
    </html>
  );
}
