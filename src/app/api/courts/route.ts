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

export async function GET() {
  try {
    const courts = await getAppCourts();
    return NextResponse.json(courts);
  } catch (e) {
    console.error("GET /api/courts failed:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
