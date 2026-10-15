import {SiteAnnouncement} from "@/components/site-announcement";
import type { Metadata } from "next";
import "./globals.css";
import {LanguageProvider} from "@/components/language";
import { OpeningAnimation } from "@/components/opening-animation";

export const metadata: Metadata = {
  title: "Namma Mallige | Flower Billing",
  description: "Where Beautiful Blooms Meet Happy Clients. Daily jasmine and pink jasmine billing with Saturday bills.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-IN">
      <body className="antialiased"><OpeningAnimation /><SiteAnnouncement /><LanguageProvider>{children}</LanguageProvider></body>
    </html>
  );
}
