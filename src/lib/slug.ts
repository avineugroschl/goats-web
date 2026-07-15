import { Court } from "./types";

// Court URL slug helpers.
//
// ⚠️ slugify() MUST stay byte-identical to the copy in
// ~/tools/court-scraper/backfill-court-slugs.js. Both generate the URL
// slug — if they diverge, stored slugs and the links/pages that read them
// drift apart and court URLs 404. Change them together.
export function slugify(name: string): string {
  return String(name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/&/g, " and ")
    .replace(/['']/g, "") // drop apostrophes: "vartan's" -> "vartans"
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Canonical site-relative path for a court. Prefers the stored slug and
// falls back to the doc id for any court not yet backfilled — so pages
// still resolve before the slug backfill has run.
export function courtPath(court: Pick<Court, "id" | "slug">): string {
  return `/courts/${court.slug || court.id}`;
}
