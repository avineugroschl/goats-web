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
import { db } from "./firebase";
import { getAdminDb } from "./firebase-admin";
import { Court } from "./types";

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

// Fetch every doc in a collection. Returns [] on error (missing collection,
// rules denial during the fallback path, etc.).
async function fetchCollection(source: Source): Promise<Court[]> {
  const admin = await getAdminDb();
  if (admin) {
    try {
      const snap = await admin.collection(source).get();
      return snap.docs.map((d) => toCourt(d.id, d.data()));
    } catch {
      return [];
    }
  }
  try {
    const snap = await getDocs(collection(db, source));
    return snap.docs.map((d) => toCourt(d.id, d.data()));
  } catch {
    return [];
  }
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
        return toCourt(d.id, d.data());
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
      return toCourt(d.id, d.data());
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
      if (snap.exists) return toCourt(snap.id, snap.data() ?? {});
    } catch {
      // fall through
    }
    return null;
  }
  try {
    const snap = await getDoc(doc(db, source, id));
    if (snap.exists()) return toCourt(snap.id, snap.data());
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
export async function getLocationGroups(): Promise<LocationGroup[]> {
  const courts = await getAllCourtsForStatic();
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
