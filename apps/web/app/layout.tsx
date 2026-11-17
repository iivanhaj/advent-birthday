import type { Metadata, Viewport } from "next";
import { Caveat, Nunito, Playfair_Display, Righteous } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

// next/font downloads these at build time and self-hosts them: no request to
// Google from visitors' browsers, and no layout shift while they load.
const playfair = Playfair_Display({ subsets: ["latin"], style: ["italic", "normal"], variable: "--font-playfair" });
const righteous = Righteous({ subsets: ["latin"], weight: "400", variable: "--font-righteous" });
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat" });
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito" });

export const metadata: Metadata = {
  title: "birthday ♡ advent calendar",
  description: "11 windows to Nov 28: one tiny build a day.",
};

export const viewport: Viewport = { themeColor: "#FBF1EE" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${righteous.variable} ${caveat.variable} ${nunito.variable}`}>
      <body className="paper-grain min-h-dvh font-body text-line antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
