import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { APP_CONFIG } from "@/lib/app-config";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.goatssportsapp.com"),
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
    "NYC basketball courts",
    "basketball courts New York",
    "pickup basketball NYC",
    "basketball courts Brooklyn",
    "basketball courts Manhattan",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.goatssportsapp.com",
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
    canonical: "https://www.goatssportsapp.com",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://www.goatssportsapp.com/#organization",
      name: "G.O.A.T.S",
      alternateName: ["GOATS", "GOATS App", "G.O.A.T.S App"],
      url: "https://www.goatssportsapp.com",
      logo: "https://www.goatssportsapp.com/icon.png",
      sameAs: [
        APP_CONFIG.appStoreUrl,
        APP_CONFIG.playStoreUrl,
        "https://www.instagram.com/goatssportsapp/",
        "https://www.facebook.com/goatspickupbasketballapp",
        "https://x.com/goatssportsapp",
        "https://www.tiktok.com/@goatssportsapp",
        "https://www.threads.com/@goatssportsapp",
        "https://www.youtube.com/@goatssportsapp",
        "https://www.linkedin.com/company/g-o-a-t-s-pickup-basketball-app",
        "https://www.crunchbase.com/organization/g-o-a-t-s",
      ],
    },
    {
      "@type": "SoftwareApplication",
      name: "G.O.A.T.S",
      alternateName: ["GOATS", "GOATS App", "G.O.A.T.S App"],
      applicationCategory: "SportsApplication",
      operatingSystem: "iOS, Android",
      description:
        "Find pickup basketball courts near you, see who's playing in real time, check in, and rate other players. The ultimate pickup basketball app.",
      url: "https://www.goatssportsapp.com",
      publisher: { "@id": "https://www.goatssportsapp.com/#organization" },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen bg-bg antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
