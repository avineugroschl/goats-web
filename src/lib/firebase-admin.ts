// Server-only Firebase Admin SDK access. Configured via the
// FIREBASE_SERVICE_ACCOUNT env var (the full service-account JSON, pasted
// into Vercel env settings). When the var is absent or invalid, returns
// null and callers fall back to the public client SDK — so local dev and
// Vercel keep working before the key is configured, and the Firestore
// rules for `courts`/`web_courts` can be tightened once it is.
//
// Never import this from a "use client" component — Admin SDK is Node-only.
import type { Firestore } from "firebase-admin/firestore";

let cachedDb: Firestore | null | undefined;

export async function getAdminDb(): Promise<Firestore | null> {
  if (cachedDb !== undefined) return cachedDb;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    cachedDb = null;
    return cachedDb;
  }
  try {
    const { initializeApp, getApps, cert } = await import("firebase-admin/app");
    const { getFirestore } = await import("firebase-admin/firestore");
    const creds = JSON.parse(raw);
    // Env-var round-trips sometimes leave the private key with literal "\n"
    // sequences; normalize to real newlines (no-op when already correct).
    if (typeof creds.private_key === "string") {
      creds.private_key = creds.private_key.replace(/\\n/g, "\n");
    }
    const app =
      getApps().length > 0
        ? getApps()[0]
        : initializeApp({ credential: cert(creds) });
    cachedDb = getFirestore(app);
  } catch (e) {
    console.error(
      "firebase-admin init failed; falling back to client SDK reads:",
      e
    );
    cachedDb = null;
  }
  return cachedDb;
}
