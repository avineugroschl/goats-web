import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

// On-demand ISR revalidation endpoint.
//
// The court detail pages (/courts/{slug}) and location hubs
// (/basketball-courts/{locationSlug}) are statically generated with a 24h
// revalidate window, so admin edits made in the app (which write to Firestore)
// wouldn't otherwise appear on the site until the window elapsed or a redeploy.
//
// The `onCourtUpdate` Cloud Function POSTs here whenever a court's public
// content changes, passing the court's slug + locationSlug, so just those pages
// regenerate within seconds.
//
// Auth is a shared token hardcoded here + in the Cloud Function. This file runs
// server-side only (never bundled to the browser) and the repo is private, so a
// constant is fine and avoids env-var setup in two systems. The token only
// guards page regeneration (no data access), so it's low-stakes; rotate by
// changing it in both places if ever needed.
// NOTE: must match REVALIDATE_TOKEN in the GoatsApp functions/src/index.ts.
const REVALIDATE_TOKEN =
  "1660b44a79b42b3adf398ed517954691e4caaae4641281c0c81c23e5cb7aa6cc";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const provided = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : req.nextUrl.searchParams.get("secret") || "";
  if (provided !== REVALIDATE_TOKEN) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { slug?: string; locationSlug?: string } = {};
  try {
    body = await req.json();
  } catch {
    // No/invalid JSON body — fall back to query params below.
  }

  const slug = body.slug || req.nextUrl.searchParams.get("slug") || undefined;
  const locationSlug =
    body.locationSlug || req.nextUrl.searchParams.get("locationSlug") || undefined;

  const revalidated: string[] = [];

  if (slug) {
    const path = `/courts/${slug}`;
    revalidatePath(path);
    revalidated.push(path);
  }

  if (locationSlug) {
    const path = `/basketball-courts/${locationSlug}`;
    revalidatePath(path);
    revalidated.push(path);
  }

  // The hub index lists every court, so refresh it too on any court change.
  revalidatePath("/basketball-courts");
  revalidated.push("/basketball-courts");

  return NextResponse.json({ ok: true, revalidated });
}
