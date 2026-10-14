import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JOOLO — Your next chapter starts here",
  description: "A 40-day cosmic self-growth challenge. Small steps, stellar progress.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
