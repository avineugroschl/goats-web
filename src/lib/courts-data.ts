import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  limit,
} from "firebase/firestore";
import { db } from "./firebase";
import { Court } from "./types";

// Server-side court reads for static generation + sitemap. `courts` is
// publicly readable, so the client SDK works fine at build time with no
// service-account credentials. `web_courts` holds bulk web-only courts
// (may not exist yet — reads are guarded).
const SOURCES = ["courts", "web_courts"] as const;

function toCourt(id: string, data: Record<string, unknown>): Court {
  return { id, ...data } as Court;
}

// Every court across both collections, deduped by slug (app `courts` wins
// over `web_courts` if a court was graduated but not yet removed). Used by
// generateStaticParams + the sitemap.
export async function getAllCourtsForStatic(): Promise<Court[]> {
  const results: Court[] = [];
  const seen = new Set<string>();
  for (const source of SOURCES) {
    let snap;
    try {
      snap = await getDocs(collection(db, source));
    } catch {
      continue; // collection may not exist yet
    }
    for (const d of snap.docs) {
      const court = toCourt(d.id, d.data());
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
  }
  return null;
}

// Resolve a court by its Firestore doc id — used to 301-redirect legacy
// /courts/{id} URLs to the new slug URL, and to render courts that predate
// the slug backfill.
export async function getCourtByLegacyId(id: string): Promise<Court | null> {
  for (const source of SOURCES) {
    try {
      const snap = await getDoc(doc(db, source, id));
      if (snap.exists()) return toCourt(snap.id, snap.data());
    } catch {
      // ignore missing collection
    }
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
