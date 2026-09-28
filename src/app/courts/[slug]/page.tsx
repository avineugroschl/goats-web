import type { Metadata } from "next";
import { permanentRedirect, notFound } from "next/navigation";
import Link from "next/link";
import { Court } from "@/lib/types";
import { courtPath } from "@/lib/slug";
import GetAppCta from "@/components/GetAppCta";
import CourtFeedbackButton from "@/components/CourtFeedbackButton";
import { getCourtBySlug, getCourtByLegacyId } from "@/lib/courts-data";

const SITE = "https://www.goatssportsapp.com";

// Statically prerender every court at build; regenerate each page ~daily and
// render newly-added courts on first request (then cache) via dynamicParams.
export const revalidate = 86400;
export const dynamicParams = true;

export async function generateStaticParams() {
  // Deliberately empty: dynamicParams + the 24h revalidate above mean every
  // court page renders on first request and then stays cached, so build time
  // no longer scales with the court count (388 today, 5,000+ planned). The
  // cost is one ISR MISS per court per day, paid by that page's first visitor.
  return [];
}

// Court pages carry name, address and coordinates only: photos, the Take and
// every other court detail are app-only by design (data protection). The
// description feeds the meta tag, Open Graph, Twitter card and JSON-LD, so it
// must not promise or leak anything beyond that.
function metaDescription(court: Court): string {
  const where = court.address ? ` at ${court.address}` : "";
  return `${court.name}, pickup basketball court${where}. Get the full court info in the G.O.A.T.S app.`.slice(
    0,
    160
  );
}

// Resolve the court for a given URL param. Returns the court, or triggers a
// 301 redirect from a legacy /courts/{id} URL to the canonical slug URL.
async function resolveCourt(slug: string): Promise<Court | null> {
  const bySlug = await getCourtBySlug(slug);
  if (bySlug) return bySlug;
  const legacy = await getCourtByLegacyId(slug);
  if (legacy?.slug && legacy.slug !== slug) {
    permanentRedirect(courtPath(legacy)); // old id URL → slug URL (301)
  }
  return legacy; // no slug yet (pre-backfill) — render at the id URL
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const court =
    (await getCourtBySlug(slug)) ?? (await getCourtByLegacyId(slug));
  if (!court) return { title: "Court not found" };

  const canonical = `${SITE}${courtPath(court)}`;
  const description = metaDescription(court);
  const area = court.geoCity ? ` in ${court.geoCity}` : "";
  const ogTitle = `${court.name} — Basketball Court${area}`;

  return {
    title: { absolute: `${ogTitle} | G.O.A.T.S` },
    description,
    alternates: { canonical },
    openGraph: {
      title: ogTitle,
      description,
      url: canonical,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: ogTitle,
      description,
    },
  };
}

function buildJsonLd(court: Court) {
  const canonical = `${SITE}${courtPath(court)}`;
  const hasGeo = court.latitude !== 0 && court.longitude !== 0;

  const place: Record<string, unknown> = {
    "@type": "SportsActivityLocation",
    "@id": canonical,
    name: court.name,
    url: canonical,
    description: metaDescription(court),
    sport: "Basketball",
  };
  if (court.address) {
    place.address = {
      "@type": "PostalAddress",
      streetAddress: court.address,
      ...(court.geoCity ? { addressLocality: court.geoCity } : {}),
      ...(court.geoState ? { addressRegion: court.geoState } : {}),
      addressCountry: "US",
    };
  }
  if (hasGeo) {
    place.geo = {
      "@type": "GeoCoordinates",
      latitude: court.latitude,
      longitude: court.longitude,
    };
  }

  // Add a breadcrumb (Basketball Courts › City › Court) when the court is
  // geocoded, tying the page into its hub.
  if (court.locationSlug && court.geoCity && court.geoState) {
    const breadcrumb = {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Basketball Courts",
          item: `${SITE}/basketball-courts`,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: `${court.geoCity}, ${court.geoState}`,
          item: `${SITE}/basketball-courts/${court.locationSlug}`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: court.name,
          item: canonical,
        },
      ],
    };
    return { "@context": "https://schema.org", "@graph": [place, breadcrumb] };
  }

  return { "@context": "https://schema.org", ...place };
}

export default async function CourtDetailsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const court = await resolveCourt(slug);
  if (!court) notFound();

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-8">
      {/* Structured data for search engines */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(court)) }}
      />

      {/* Back to the main court list */}
      <Link
        href="/courts"
        className="mb-4 inline-flex items-center gap-2 text-teal hover:text-teal-dark"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to courts
      </Link>

      {/* Breadcrumb (geocoded courts only) */}
      {court.locationSlug && court.geoCity && court.geoState && (
        <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-text-muted">
          <Link href="/basketball-courts" className="text-teal hover:text-teal-dark">
            Search by Area
          </Link>
          <span>/</span>
          <Link
            href={`/basketball-courts/${court.locationSlug}`}
            className="text-teal hover:text-teal-dark"
          >
            {court.geoCity}, {court.geoState}
          </Link>
          <span>/</span>
          <span className="truncate text-text-secondary">{court.name}</span>
        </nav>
      )}

      {/* Court Name & Address */}
      <div className="mb-6">
        <h1 className="mb-2 text-3xl font-bold">{court.name}</h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <p className="text-teal">{court.address}</p>
          {court.latitude !== 0 && court.longitude !== 0 && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${court.latitude},${court.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-teal shadow-sm transition-shadow hover:shadow-md"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Open in Maps
            </a>
          )}
        </div>
      </div>

      {/* Get the app CTA */}
      <GetAppCta className="mb-8" />

      {/* Tell us about the court */}
      <CourtFeedbackButton
        courtId={court.id}
        courtName={court.name}
        courtSlug={court.slug || court.id}
      />
    </main>
  );
}
