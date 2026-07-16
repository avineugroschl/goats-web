import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import { courtPath } from "@/lib/slug";
import {
  getLocationGroups,
  getLocationBySlug,
  type LocationGroup,
} from "@/lib/courts-data";

const SITE = "https://www.goatssportsapp.com";

export const revalidate = 86400;
export const dynamicParams = true;

export async function generateStaticParams() {
  const groups = await getLocationGroups();
  return groups.map((g) => ({ location: g.locationSlug }));
}

function headline(g: LocationGroup): string {
  return `Basketball Courts in ${g.city}, ${g.state}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ location: string }>;
}): Promise<Metadata> {
  const { location } = await params;
  const g = await getLocationBySlug(location);
  if (!g) return { title: "Basketball Courts" };

  const canonical = `${SITE}/basketball-courts/${g.locationSlug}`;
  const n = g.courts.length;
  const description =
    `Find ${n} pickup basketball court${n !== 1 ? "s" : ""} in ${g.city}, ${g.stateName} — court conditions, hours, hoops, 3-point lines and who's playing, on G.O.A.T.S.`.slice(
      0,
      160
    );

  return {
    title: { absolute: `${headline(g)} | G.O.A.T.S` },
    description,
    alternates: { canonical },
    openGraph: {
      title: headline(g),
      description,
      url: canonical,
      type: "website",
    },
  };
}

function buildJsonLd(g: LocationGroup) {
  const canonical = `${SITE}/basketball-courts/${g.locationSlug}`;
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": canonical,
    url: canonical,
    name: headline(g),
    breadcrumb: {
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
          name: `${g.city}, ${g.state}`,
          item: canonical,
        },
      ],
    },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: g.courts.length,
      itemListElement: g.courts.map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: c.name,
        url: `${SITE}${courtPath(c)}`,
      })),
    },
  };
}

export default async function LocationHubPage({
  params,
}: {
  params: Promise<{ location: string }>;
}) {
  const { location } = await params;
  const g = await getLocationBySlug(location);
  if (!g) notFound();

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(g)) }}
      />

      {/* Back to the previous page */}
      <BackButton fallback="/basketball-courts" label="Back" className="mb-4 text-sm" />

      {/* Breadcrumb */}
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-text-muted">
        <Link href="/basketball-courts" className="text-teal hover:text-teal-dark">
          Search by Area
        </Link>
        <span>/</span>
        <span className="text-text-secondary">
          {g.city}, {g.state}
        </span>
      </nav>

      <h1 className="mb-2 text-3xl font-bold">{headline(g)}</h1>
      <p className="mb-6 text-text-secondary">
        {g.courts.length} pickup basketball court
        {g.courts.length !== 1 ? "s" : ""} in {g.city}, {g.stateName}. Tap any
        court for conditions, hoops, hours, and who&apos;s playing.
      </p>

      {/* Get the app CTA */}
      <div className="mb-8 flex flex-col gap-4 rounded-2xl bg-teal-light p-5 sm:flex-row sm:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/app-icon.png" alt="G.O.A.T.S" className="h-12 w-12 flex-shrink-0 rounded-xl" />
        <div className="flex-1">
          <p className="font-semibold text-teal-dark">
            See who&apos;s playing and much more
          </p>
          <p className="text-sm text-text-secondary">
            Download the app and never miss the action
          </p>
        </div>
        <Link
          href="/"
          className="flex-shrink-0 rounded-full bg-coral px-6 py-3 text-center font-semibold text-text-on-dark transition-colors hover:bg-coral-dark"
        >
          Get the G.O.A.T.S App
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        {g.courts.map((court) => {
          const img = court.photoUrlCard || court.photoUrl;
          return (
            <Link
              key={court.id}
              href={courtPath(court)}
              className="flex gap-4 rounded-2xl bg-surface p-3 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-surface-variant">
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={img}
                    alt={court.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-text-muted">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </div>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center">
                <h2 className="truncate text-base font-bold">{court.name}</h2>
                <p className="truncate text-sm text-teal">{court.address}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 text-xs sm:text-sm">
                  <span className="text-text-secondary">
                    {court.baskets} basket{court.baskets !== 1 ? "s" : ""}
                  </span>
                  <span className="font-medium text-teal">{court.setting}</span>
                  <span className="text-text-muted">{court.accessType}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
