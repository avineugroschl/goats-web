import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://goatssportsapp.com"),
  title: {
    default: "G.O.A.T.S - Find Pickup Basketball Courts Near You",
    template: "%s | G.O.A.T.S - Pickup Basketball App",
  },
  description:
    "G.O.A.T.S is the pickup basketball app that helps you find courts, see who's playing, and check in. Browse basketball courts, check real-time activity, and join the game.",
  keywords: [
    "GOATS",
    "GOATS app",
    "G.O.A.T.S",
    "pickup basketball",
    "basketball courts",
    "find basketball courts",
    "basketball court finder",
    "pickup basketball app",
    "basketball near me",
    "outdoor basketball courts",
    "indoor basketball courts",
    "basketball check in",
    "who's playing basketball",
    "local basketball",
    "basketball court map",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://goatssportsapp.com",
    siteName: "G.O.A.T.S - Pickup Basketball",
    title: "G.O.A.T.S - Find Pickup Basketball Courts Near You",
    description:
      "Find basketball courts, see who's playing right now, and check in. The pickup basketball app.",
  },
  twitter: {
    card: "summary_large_image",
    title: "G.O.A.T.S - Find Pickup Basketball Courts Near You",
    description:
      "Find basketball courts, see who's playing right now, and check in. The pickup basketball app.",
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "https://goatssportsapp.com",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "G.O.A.T.S",
  alternateName: ["GOATS", "GOATS App", "G.O.A.T.S App"],
  applicationCategory: "SportsApplication",
  operatingSystem: "iOS, Android",
  description:
    "Find pickup basketball courts near you, see who's playing in real time, check in, and rate other players. The ultimate pickup basketball app.",
  url: "https://goatssportsapp.com",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen bg-bg antialiased">{children}</body>
    </html>
  );
}
