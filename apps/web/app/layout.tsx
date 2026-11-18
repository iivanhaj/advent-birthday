import type { Metadata, Viewport } from "next";
import { Caveat, Inter, Playfair_Display } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

// next/font downloads these at build time and self-hosts them: no request to
// Google from visitors' browsers, and no layout shift while they load.
const playfair = Playfair_Display({ subsets: ["latin"], style: ["italic", "normal"], variable: "--font-playfair" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
// Caveat only survives for hand-written notes inside the door pages.
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat" });

export const metadata: Metadata = {
  title: "birthday ♡ advent calendar",
  description: "11 windows to Nov 28: one tiny build a day.",
};

export const viewport: Viewport = { themeColor: "#FBF1EE" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable} ${caveat.variable}`}>
      <body className="paper-grain min-h-dvh font-body text-line antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
