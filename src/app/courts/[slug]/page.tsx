import type { Metadata } from "next";
import { permanentRedirect, notFound } from "next/navigation";
import Link from "next/link";
import { Court } from "@/lib/types";
import { courtPath } from "@/lib/slug";
import {
  getAllCourtsForStatic,
  getCourtBySlug,
  getCourtByLegacyId,
} from "@/lib/courts-data";

const SITE = "https://goatssportsapp.com";

// Statically prerender every court at build; regenerate each page ~daily and
// render newly-added courts on first request (then cache) via dynamicParams.
export const revalidate = 86400;
export const dynamicParams = true;

export async function generateStaticParams() {
  const courts = await getAllCourtsForStatic();
  return courts.map((c) => ({ slug: c.slug || c.id }));
}

function heroImageOf(court: Court): string | undefined {
  return court.photoUrlFull || court.photoUrlCard || court.photoUrl || undefined;
}

function metaDescription(court: Court): string {
  const take = (court.goatsTake || "").trim();
  if (take) {
    return take.length > 155
      ? take.slice(0, 152).replace(/\s+\S*$/, "") + "…"
      : take;
  }
  const where = court.address ? ` at ${court.address}` : "";
  return `${court.name} — pickup basketball court${where}. Baskets, hours, condition, 3-point line and who's playing, on G.O.A.T.S.`.slice(
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
  const image = heroImageOf(court);
  const ogTitle = `${court.name} — Basketball Court`;

  return {
    title: { absolute: `${ogTitle} | G.O.A.T.S` },
    description,
    alternates: { canonical },
    openGraph: {
      title: ogTitle,
      description,
      url: canonical,
      type: "website",
      images: image ? [image] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
      images: image ? [image] : undefined,
    },
  };
}

function buildJsonLd(court: Court) {
  const canonical = `${SITE}${courtPath(court)}`;
  const hasGeo = court.latitude !== 0 && court.longitude !== 0;
  const image = heroImageOf(court);

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    "@id": canonical,
    name: court.name,
    url: canonical,
    description: metaDescription(court),
    sport: "Basketball",
  };
  if (image) data.image = image;
  if (court.address) {
    data.address = {
      "@type": "PostalAddress",
      streetAddress: court.address,
      addressCountry: "US",
    };
  }
  if (hasGeo) {
    data.geo = {
      "@type": "GeoCoordinates",
      latitude: court.latitude,
      longitude: court.longitude,
    };
  }
  if (court.phoneNumber) data.telephone = court.phoneNumber;
  return data;
}

export default async function CourtDetailsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const court = await resolveCourt(slug);
  if (!court) notFound();

  const heroImage = heroImageOf(court);

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-8">
      {/* Structured data for search engines */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(court)) }}
      />

      {/* Back link */}
      <Link
        href="/courts"
        className="mb-6 inline-flex items-center gap-2 text-teal hover:text-teal-dark"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to courts
      </Link>

      {/* Hero Image */}
      {heroImage && (
        <div className="mb-6 overflow-hidden rounded-2xl shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroImage}
            alt={court.name}
            className="w-full object-cover"
            style={{ aspectRatio: "3 / 2" }}
          />
        </div>
      )}

      {/* Court Name & Address */}
      <div className="mb-6">
        <h1 className="mb-2 text-3xl font-bold">{court.name}</h1>
        <p className="text-teal">{court.address}</p>
      </div>

      {/* Get the app CTA */}
      <div className="mb-8 flex items-center gap-4 rounded-2xl bg-teal-light p-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/app-icon.png" alt="G.O.A.T.S" className="h-12 w-12 rounded-xl" />
        <div>
          <p className="font-semibold text-teal-dark">
            See who&apos;s playing and check in
          </p>
          <p className="text-sm text-text-secondary">
            Download the G.O.A.T.S app for real-time updates
          </p>
        </div>
      </div>

      {/* Court Info */}
      <section className="mb-8 rounded-2xl bg-surface p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-bold">Court Details</h2>
        <div className="grid grid-cols-2 gap-y-5 gap-x-8">
          <InfoRow label="Baskets" value={String(court.baskets)} />
          <InfoRow label="Setting" value={court.setting} />
          <InfoRow label="Access" value={court.accessType} />
          <InfoRow label="Condition" value={court.courtCondition} />
          <InfoRow label="3-Point Line" value={court.threePointLine} />
          <InfoRow label="Lights" value={court.hasLights ? "Yes" : "No"} />
          {court.hoursOfOperation && (
            <InfoRow label="Hours" value={court.hoursOfOperation} />
          )}
          {court.phoneNumber && (
            <InfoRow label="Phone" value={court.phoneNumber} />
          )}
        </div>
      </section>

      {/* Goats Take */}
      {court.goatsTake && (
        <section className="mb-8 rounded-2xl bg-surface p-6 shadow-sm">
          <h2 className="mb-3 text-xl font-bold">
            <span className="text-teal">G.O.A.T.S</span> Take
          </h2>
          <p className="leading-relaxed text-text-secondary">
            {court.goatsTake}
          </p>
        </section>
      )}

      {/* Map Link */}
      {court.latitude !== 0 && court.longitude !== 0 && (
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${court.latitude},${court.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-8 flex items-center justify-center gap-2 rounded-2xl bg-surface p-4 text-teal shadow-sm transition-shadow hover:shadow-md"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          Open in Google Maps
        </a>
      )}

      {/* Footer CTA */}
      <div className="py-8 text-center">
        <Link
          href="/"
          className="inline-block rounded-full bg-coral px-8 py-3 font-semibold text-text-on-dark transition-colors hover:bg-coral-dark"
        >
          Get the G.O.A.T.S App
        </Link>
      </div>
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
        {label}
      </p>
      <p className="mt-0.5 font-semibold">{value}</p>
    </div>
  );
}
