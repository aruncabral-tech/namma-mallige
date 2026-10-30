import {SiteAnnouncement} from "@/components/site-announcement";
import type { Metadata } from "next";
import "./globals.css";
import {LanguageProvider} from "@/components/language";
import { OpeningAnimation } from "@/components/opening-animation";

const siteUrl = "https://nammamallige.store";
const siteDescription =
  "Follow daily Mallige and Jajji market rates, record flower quantities and payments, and prepare weekly Saturday bills with Namma Mallige’s online flower book.";

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: `${siteUrl}/`,
      name: "Namma Mallige",
      description: siteDescription,
      inLanguage: "en-IN",
      publisher: { "@id": `${siteUrl}/#organization` },
    },
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "Namma Mallige",
      url: `${siteUrl}/`,
      logo: `${siteUrl}/brand-logo.png`,
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${siteUrl}/#flower-book`,
      name: "Namma Mallige Flower Book",
      url: `${siteUrl}/`,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: siteDescription,
      featureList: [
        "Daily Mallige and Jajji market reference rates",
        "Flower quantity and payment records",
        "Customer balances and weekly Saturday bills",
      ],
    },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Namma Mallige | Mallige & Jajji Market Rates and Flower Billing",
  description: siteDescription,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Namma Mallige",
    locale: "en_IN",
    title: "Namma Mallige | Fresh Mallige & Jajji Rates",
    description: siteDescription,
    images: [
      {
        url: "/mallige-garland-hero.png",
        alt: "Fresh Mallige jasmine garland on a banana leaf",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Namma Mallige | Fresh Mallige & Jajji Rates",
    description: siteDescription,
    images: ["/mallige-garland-hero.png"],
  },
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
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body className="antialiased"><OpeningAnimation /><SiteAnnouncement /><LanguageProvider>{children}</LanguageProvider></body>
    </html>
  );
}
