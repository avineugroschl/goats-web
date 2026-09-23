import { NextResponse } from "next/server";
import { getAppCourts } from "@/lib/courts-data";

// Server-side courts feed for the /courts directory page. The page used to
// query Firestore directly from the browser, which required the `courts`
// collection to be world-readable; this route reads server-side (Admin SDK
// when configured, public client SDK otherwise) so the browser never talks
// to Firestore for it.
//
// Cached for 60s so Firestore sees at most ~1 read burst/minute regardless
// of traffic.
export const revalidate = 60;

// Exactly the fields the /courts directory page renders — nothing more. The
// full court docs (takes, hours, operator fields, ...) used to be dumped here
// wholesale, which quietly undercut the auth-gated Firestore rules: anyone
// with curl got the entire dataset. What remains is no more than what the
// public court pages already show.
function toDirectoryCourt(c: Record<string, unknown>) {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    address: c.address,
    setting: c.setting,
    accessType: c.accessType,
    baskets: c.baskets,
    courtCondition: c.courtCondition,
    latitude: c.latitude,
    longitude: c.longitude,
    photoUrl: c.photoUrl,
    photoUrlCard: c.photoUrlCard,
  };
}

export async function GET(req: Request) {
  // Opportunistic same-origin check: modern browsers stamp Sec-Fetch-Site on
  // every request, and the /courts page is this route's only legitimate
  // caller. A cross-site value is never that page. The header's absence is
  // allowed (older Safari, some proxies) — the field trim above is the real
  // protection; this just turns away lazy scrapers.
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const courts = await getAppCourts();
    return NextResponse.json(
      courts.map((c) => toDirectoryCourt(c as unknown as Record<string, unknown>))
    );
  } catch (e) {
    console.error("GET /api/courts failed:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
