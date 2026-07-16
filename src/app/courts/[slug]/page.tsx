import type { Metadata } from "next";
import type { ReactNode } from "react";
import { permanentRedirect, notFound } from "next/navigation";
import Link from "next/link";
import { Court } from "@/lib/types";
import { courtPath } from "@/lib/slug";
import GetAppCta from "@/components/GetAppCta";
import CourtFeedbackButton from "@/components/CourtFeedbackButton";
import {
  getAllCourtsForStatic,
  getCourtBySlug,
  getCourtByLegacyId,
  getRegularsCount,
} from "@/lib/courts-data";

const SITE = "https://www.goatssportsapp.com";

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

// Decorative avatar tints for the regulars stack (the faces are generic, the
// count is real).
const AVATAR_TINTS = [
  "bg-teal text-text-on-dark",
  "bg-coral text-text-on-dark",
  "bg-teal-light text-teal-dark",
  "bg-teal-dark text-text-on-dark",
  "bg-coral-dark text-text-on-dark",
];

// Turn bare URLs / www links inside a GOATS take into clickable anchors,
// leaving the surrounding text untouched. Trailing sentence punctuation is
// peeled off the link so "(see nycgovparks.org)." doesn't swallow the ")." .
function linkify(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    let url = match[0];
    const trailing = url.match(/[.,;:!?)\]]+$/)?.[0] ?? "";
    if (trailing) url = url.slice(0, url.length - trailing.length);
    const href = url.startsWith("http") ? url : `https://${url}`;
    nodes.push(
      <a
        key={match.index}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-teal underline underline-offset-2 hover:text-teal-dark"
      >
        {url}
      </a>
    );
    if (trailing) nodes.push(trailing);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
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

  const place: Record<string, unknown> = {
    "@type": "SportsActivityLocation",
    "@id": canonical,
    name: court.name,
    url: canonical,
    description: metaDescription(court),
    sport: "Basketball",
  };
  if (image) place.image = image;
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
  if (court.phoneNumber) place.telephone = court.phoneNumber;

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

  const heroImage = heroImageOf(court);
  const regularsCount = await getRegularsCount(court.id);

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

      {/* Regulars social proof — real favoriter count, decorative avatars */}
      {regularsCount > 0 && (
        <section className="mb-8 rounded-2xl bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex flex-shrink-0 -space-x-3">
              {Array.from({ length: Math.min(regularsCount, 5) }).map((_, i) => (
                <div
                  key={i}
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 border-surface ${AVATAR_TINTS[i % AVATAR_TINTS.length]}`}
                  style={{ zIndex: 5 - i }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5z" /></svg>
                </div>
              ))}
            </div>
            <div className="min-w-0">
              <p className="font-semibold">
                {regularsCount} player{regularsCount !== 1 ? "s" : ""} call
                {regularsCount === 1 ? "s" : ""} this their court
              </p>
              <p className="text-sm text-text-secondary">
                Favorite this court in the app to get notified when there&apos;s
                action.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Get the app CTA */}
      <GetAppCta className="mb-8" />

      {/* Goats Take */}
      {court.goatsTake && (
        <section className="mb-4 rounded-2xl bg-surface p-6 shadow-sm">
          <h2 className="mb-3 text-xl font-bold">
            <span className="text-teal">G.O.A.T.S</span> Take
          </h2>
          <p className="leading-relaxed text-text-secondary">
            {linkify(court.goatsTake)}
          </p>
        </section>
      )}

      {/* Edits, thoughts, or comments? */}
      <CourtFeedbackButton
        courtId={court.id}
        courtName={court.name}
        courtSlug={court.slug || court.id}
      />

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
