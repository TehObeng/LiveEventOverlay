import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Live Chat Overlay",
  description: "Real-time chat overlay system for live events",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body style={{ background: 'transparent' }}>{children}</body>
    </html>
  );
}
