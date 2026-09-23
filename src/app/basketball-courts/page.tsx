import type { Metadata } from "next";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import { getLocationGroups } from "@/lib/courts-data";

const SITE = "https://www.goatssportsapp.com";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: { absolute: "Basketball Courts by City | G.O.A.T.S" },
  description:
    "Browse pickup basketball courts by city and borough — conditions, hours, hoops, and who's playing. Find a court near you on G.O.A.T.S.",
  alternates: { canonical: `${SITE}/basketball-courts` },
  openGraph: {
    title: "Basketball Courts by City",
    description:
      "Browse pickup basketball courts by city and borough. Find a court near you on G.O.A.T.S.",
    url: `${SITE}/basketball-courts`,
    type: "website",
  },
};

export default async function BasketballCourtsIndex() {
  const groups = await getLocationGroups();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${SITE}/basketball-courts`,
    url: `${SITE}/basketball-courts`,
    name: "Basketball Courts by City",
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: groups.length,
      itemListElement: groups.map((g, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: `Basketball Courts in ${g.city}, ${g.state}`,
        url: `${SITE}/basketball-courts/${g.locationSlug}`,
      })),
    },
  };

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mb-6 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/app-icon.png" alt="G.O.A.T.S" className="h-8 w-8 rounded-lg" />
          <span className="wordmark text-base">G.O.A.T.S</span>
        </Link>
      </div>

      {/* Back to the previous page + browse the full court list */}
      <div className="mb-6 flex items-center justify-between text-sm">
        <BackButton fallback="/courts" label="Back" />
        <Link href="/courts" className="text-teal hover:text-teal-dark">
          Browse all courts &rarr;
        </Link>
      </div>

      <h1 className="mb-2 text-3xl font-bold">Basketball Courts by City</h1>
      <p className="mb-8 text-text-secondary">
        Find pickup basketball courts near you. Browse by city and borough for
        court conditions, hours, hoops, and real-time activity.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {groups.map((g) => (
          <Link
            key={g.locationSlug}
            href={`/basketball-courts/${g.locationSlug}`}
            className="flex items-center justify-between rounded-2xl bg-surface p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <span className="font-semibold">
              {g.city}, {g.state}
            </span>
            <span className="text-sm text-text-muted">
              {g.courts.length} court{g.courts.length !== 1 ? "s" : ""}
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
