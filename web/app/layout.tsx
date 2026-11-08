import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "@fontsource/poppins/800-italic.css";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { HorizonBackground } from "@/lib/HorizonBackground";

export const metadata: Metadata = {
  title: "BlinkTalk",
  description: "Hold a conversation with your eyes.",
};

export const viewport: Viewport = {
  themeColor: "#233a41",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <HorizonBackground />
        {children}
      </body>
    </html>
  );
}