import "./globals.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { WaterBackground } from "@/lib/WaterBackground";

export const metadata: Metadata = {
  title: "BlinkTalk",
  description: "Hold a conversation with your eyes.",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <WaterBackground />
        {children}
      </body>
    </html>
  );
}