'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { APP_CONFIG, getDeviceType, buildStoreUrl } from '@/lib/app-config';

const FIRESTORE_BASE =
  'https://firestore.googleapis.com/v1/projects/goat-db/databases/(default)/documents';

export default function AmbassadorRedirect() {
  const params = useParams<{ code: string }>();

  useEffect(() => {
    const rawCode = params?.code ?? '';
    const code = rawCode.trim().toUpperCase();

    if (code.length === 0) {
      window.location.href = APP_CONFIG.homeUrl;
      return;
    }

    const device = getDeviceType();

    // Carry through any utm_* the ambassador appended, in addition to ours.
    const incoming = new URLSearchParams(window.location.search);
    const utmParams: Record<string, string> = {
      utm_source: 'ambassador',
      utm_medium: code,
    };
    for (const [key, value] of incoming.entries()) {
      if (key.startsWith('utm_')) utmParams[key] = value;
    }

    const destination =
      device === 'ios'
        ? buildStoreUrl(APP_CONFIG.appStoreUrl, utmParams)
        : device === 'android'
          ? // Play Install Referrer surfaces the `referrer` query param to
            // the app on first launch. Pass the bare code — Android side
            // decodes url-encoded value and reads it directly.
            buildStoreUrl(APP_CONFIG.playStoreUrl, { ...utmParams, referrer: code })
          : APP_CONFIG.homeUrl;

    // localStorage so iOS users can pick up the code if they come back to
    // the site after installing (web → app handoff). Non-fatal.
    try {
      window.localStorage.setItem('goatsReferralCode', code);
    } catch {
      // Private-mode / quota errors.
    }

    // Fire-and-forget the click log via the Firestore REST API with
    // `keepalive: true`. This is the browser API designed for "complete
    // this request even if the page navigates away" (capped at 64KB).
    //
    // Why not the Firestore Web SDK: `addDoc` requires the SDK to finish
    // its IndexedDB bootstrap before it can issue the network request,
    // which can take 300ms+ on a cold visit and stalls indefinitely
    // under Safari ITP / lockdown mode. The redirect cancels in-flight
    // requests almost immediately, so SDK-bootstrap latency = dropped
    // clicks in the wild.
    //
    // Why no `getDoc` prefilter: `onAmbassadorClickCreated` already
    // deletes orphan clicks whose parent ambassador doesn't exist, so a
    // fake-code click costs one trigger run and self-destructs server
    // side. Skipping the prefilter halves the latency on the happy path.
    //
    // `ts` is client-time (REST API doesn't support `serverTimestamp()`
    // sentinels without a separate documentTransform — for a click
    // counter, ±seconds of clock drift is fine).
    try {
      void fetch(
        `${FIRESTORE_BASE}/ambassadors/${encodeURIComponent(code)}/clicks`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: {
              ts: { timestampValue: new Date().toISOString() },
              platform: { stringValue: device },
              userAgent: { stringValue: navigator.userAgent.slice(0, 256) },
            },
          }),
          keepalive: true,
        },
      ).catch(() => {});
    } catch {
      // Network/CSP/blocker errors don't matter — user already redirected.
    }

    window.location.href = destination;
  }, [params]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-dark">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-teal" />
    </div>
  );
}
