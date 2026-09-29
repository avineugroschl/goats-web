import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  limit,
  getCountFromServer,
} from "firebase/firestore";
import { unstable_cache } from "next/cache";
import { db } from "./firebase";
import { getAdminDb } from "./firebase-admin";
import { Court } from "./types";

// ---------------------------------------------------------------------------
// COST NOTE (2026-09-28). Every collection-wide read below costs one Firestore
// read PER COURT DOC, and it used to run on EVERY render of the sitemap, the
// /basketball-courts index, every city hub and /api/courts — i.e. on every
// crawler hit once a page went stale. Measured: ~250 full reads/day at 388
// courts (~100k reads/day), and with 5,388 courts in the collection that
// became 780k reads in ONE HOUR after a bulk write marked the pages stale.
// Two fixes here:
//   1. `fetchCollection` is wrapped in `unstable_cache` (Vercel Data Cache),
//      tagged so /api/revalidate can drop it on a real edit, and re-read at
//      most every 6h otherwise. It also SELECTs only the handful of fields the
//      collection-wide callers use, so the cached entry stays well under
//      Vercel's 2MB per-entry cap (a full court doc with its take and photo
//      URLs would not at scale).
//   2. City hubs query `where locationSlug ==` instead of scanning everything.
// The per-court page (`getCourtBySlug`) was already a single-doc query.
// ---------------------------------------------------------------------------

export const COURTS_CACHE_TAG = "courts";
const COURTS_CACHE_SECONDS = 6 * 60 * 60;

// The only fields the collection-wide readers (sitemap, hubs, /api/courts)
// need. Keep in sync with `toDirectoryCourt` in /api/courts and the hub
// grouping below. No Timestamps: the cache serialises to JSON.
const SLIM_FIELDS = [
  "slug",
  "name",
  "address",
  "latitude",
  "longitude",
  "locationSlug",
  "geoCity",
  "geoState",
  "geoStateName",
  "published",
  "adminOnly",
  "operatorIds",
] as const;

// Server-side court reads for static generation + sitemap + the /api/courts
// route. Prefers the Admin SDK (FIREBASE_SERVICE_ACCOUNT env var — bypasses
// Firestore rules, so `courts` no longer needs to be publicly readable) and
// falls back to the public client SDK when the service account isn't
// configured, so builds keep working either way. `web_courts` holds bulk
// web-only courts (may not exist yet — reads are guarded).
const SOURCES = ["courts", "web_courts"] as const;
type Source = (typeof SOURCES)[number];

function toCourt(id: string, data: Record<string, unknown>): Court {
  return { id, ...data } as Court;
}

// Same visibility rule the apps use: unpublished operator drafts and
// admin-only courts (the testSeed courts, adminTestCourt) never reach the
// public site. Every read below goes through it, so the /courts directory,
// court pages, hubs and sitemap can't disagree.
export function isPublicCourt(c: { published?: boolean; adminOnly?: boolean }): boolean {
  return c.published !== false && c.adminOnly !== true;
}

// Fetch every doc in a collection (slim projection — see COST NOTE). Returns
// [] on error (missing collection, rules denial during the fallback path).
async function fetchCollectionUncached(source: Source): Promise<Court[]> {
  const admin = await getAdminDb();
  if (admin) {
    try {
      const snap = await admin
        .collection(source)
        .select(...SLIM_FIELDS)
        .get();
      return snap.docs.map((d) => toCourt(d.id, d.data())).filter(isPublicCourt);
    } catch {
      return [];
    }
  }
  try {
    const snap = await getDocs(collection(db, source));
    return snap.docs
      .map((d) => {
        const data = d.data();
        const slim: Record<string, unknown> = {};
        for (const f of SLIM_FIELDS) if (f in data) slim[f] = data[f];
        return toCourt(d.id, slim);
      })
      .filter(isPublicCourt);
  } catch {
    return [];
  }
}

// Cached for COURTS_CACHE_SECONDS across every render and every Vercel
// function instance; /api/revalidate drops it by tag on a real court edit.
const fetchCollectionCached = unstable_cache(
  async (source: Source) => fetchCollectionUncached(source),
  ["courts-collection-slim-v1"],
  { revalidate: COURTS_CACHE_SECONDS, tags: [COURTS_CACHE_TAG] }
);

async function fetchCollection(source: Source): Promise<Court[]> {
  return fetchCollectionCached(source);
}

// One city/borough's courts by a single equality query — a hub render costs
// that hub's courts, not the whole directory. Falls back to the cached full
// list only when the Admin SDK isn't configured.
async function fetchByLocationSlug(locationSlug: string): Promise<Court[] | null> {
  const admin = await getAdminDb();
  if (!admin) return null;
  const results: Court[] = [];
  const seen = new Set<string>();
  for (const source of SOURCES) {
    try {
      const snap = await admin
        .collection(source)
        .where("locationSlug", "==", locationSlug)
        .select(...SLIM_FIELDS)
        .get();
      for (const d of snap.docs) {
        const court = toCourt(d.id, d.data());
        if (!isPublicCourt(court)) continue;
        const key = court.slug || court.id;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push(court);
      }
    } catch {
      // missing collection etc. — keep going
    }
  }
  return results;
}

async function fetchBySlug(source: Source, slug: string): Promise<Court | null> {
  const admin = await getAdminDb();
  if (admin) {
    try {
      const snap = await admin
        .collection(source)
        .where("slug", "==", slug)
        .limit(1)
        .get();
      if (!snap.empty) {
        const d = snap.docs[0];
        const court = toCourt(d.id, d.data());
        return isPublicCourt(court) ? court : null;
      }
    } catch {
      // fall through
    }
    return null;
  }
  try {
    const snap = await getDocs(
      query(collection(db, source), where("slug", "==", slug), limit(1))
    );
    if (!snap.empty) {
      const d = snap.docs[0];
      const court = toCourt(d.id, d.data());
      return isPublicCourt(court) ? court : null;
    }
  } catch {
    // ignore missing collection
  }
  return null;
}

async function fetchById(source: Source, id: string): Promise<Court | null> {
  const admin = await getAdminDb();
  if (admin) {
    try {
      const snap = await admin.collection(source).doc(id).get();
      if (snap.exists) {
        const court = toCourt(snap.id, snap.data() ?? {});
        return isPublicCourt(court) ? court : null;
      }
    } catch {
      // fall through
    }
    return null;
  }
  try {
    const snap = await getDoc(doc(db, source, id));
    if (snap.exists()) {
      const court = toCourt(snap.id, snap.data());
      return isPublicCourt(court) ? court : null;
    }
  } catch {
    // ignore missing collection
  }
  return null;
}

// The app's live courts only (no web_courts) — powers the /courts directory
// page via /api/courts. Same data the mobile apps show.
export async function getAppCourts(): Promise<Court[]> {
  return fetchCollection("courts");
}

// Every court across both collections, deduped by slug (app `courts` wins
// over `web_courts` if a court was graduated but not yet removed). Used by
// generateStaticParams + the sitemap.
export async function getAllCourtsForStatic(): Promise<Court[]> {
  const results: Court[] = [];
  const seen = new Set<string>();
  for (const source of SOURCES) {
    const courts = await fetchCollection(source);
    for (const court of courts) {
      const key = court.slug || court.id;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(court);
    }
  }
  return results;
}

// Resolve a court by its URL slug. Checks the app collection first.
export async function getCourtBySlug(slug: string): Promise<Court | null> {
  for (const source of SOURCES) {
    const court = await fetchBySlug(source, slug);
    if (court) return court;
  }
  return null;
}

// Resolve a court by its Firestore doc id — used to 301-redirect legacy
// /courts/{id} URLs to the new slug URL, and to render courts that predate
// the slug backfill.
export async function getCourtByLegacyId(id: string): Promise<Court | null> {
  for (const source of SOURCES) {
    const court = await fetchById(source, id);
    if (court) return court;
  }
  return null;
}

// A city/borough grouping of courts, backing the /basketball-courts hub pages.
export interface LocationGroup {
  locationSlug: string;
  city: string; // borough for NYC, e.g. "Manhattan"
  stateName: string; // e.g. "New York"
  state: string; // 2-letter, e.g. "NY"
  courts: Court[];
}

// Group all geocoded courts by locationSlug. Courts without geo data are
// omitted (they still have their own /courts/{slug} page). Groups sorted by
// court count desc; courts within a group sorted by name.
export async function getLocationGroups(
  preloaded?: Court[]
): Promise<LocationGroup[]> {
  // The sitemap already holds the full list — accept it rather than reading
  // the whole collection a second time in the same request.
  const courts = preloaded ?? (await getAllCourtsForStatic());
  const map = new Map<string, LocationGroup>();
  for (const c of courts) {
    if (!c.locationSlug || !c.geoCity || !c.geoState) continue;
    let g = map.get(c.locationSlug);
    if (!g) {
      g = {
        locationSlug: c.locationSlug,
        city: c.geoCity,
        stateName: c.geoStateName || c.geoState,
        state: c.geoState,
        courts: [],
      };
      map.set(c.locationSlug, g);
    }
    g.courts.push(c);
  }
  const groups = [...map.values()];
  for (const g of groups) g.courts.sort((a, b) => a.name.localeCompare(b.name));
  groups.sort(
    (a, b) => b.courts.length - a.courts.length || a.city.localeCompare(b.city)
  );
  return groups;
}

export async function getLocationBySlug(
  locationSlug: string
): Promise<LocationGroup | null> {
  const direct = await fetchByLocationSlug(locationSlug);
  if (direct !== null) {
    const groups = await getLocationGroups(direct);
    return groups.find((g) => g.locationSlug === locationSlug) || null;
  }
  const groups = await getLocationGroups();
  return groups.find((g) => g.locationSlug === locationSlug) || null;
}

// Count of "regulars" — players who favorited this court and consented to
// appear (members where visible == true). Powers the "X players call this
// their court" section on the court page. Returns 0 on any error so the
// section simply hides.
export async function getRegularsCount(courtId: string): Promise<number> {
  const admin = await getAdminDb();
  if (admin) {
    try {
      const snap = await admin
        .collection("courts")
        .doc(courtId)
        .collection("members")
        .where("visible", "==", true)
        .count()
        .get();
      return snap.data().count;
    } catch {
      return 0;
    }
  }
  try {
    const snap = await getCountFromServer(
      query(
        collection(db, "courts", courtId, "members"),
        where("visible", "==", true)
      )
    );
    return snap.data().count;
  } catch {
    return 0;
  }
}
