'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { APP_CONFIG, getDeviceType, buildStoreUrl } from '@/lib/app-config';

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

    // Fire-and-forget the click log. The redirect MUST NOT be gated on
    // Firestore: Safari can stall Firestore's IndexedDB bootstrap under
    // ITP / lockdown mode / content blockers, leaving an awaited getDoc
    // pending forever without throwing. That used to leave users staring
    // at a spinner that never resolved. The click write either lands
    // before navigation cancels in-flight requests, or it's dropped —
    // non-critical compared to actually delivering the user to the store.
    void (async () => {
      try {
        const snap = await getDoc(doc(db, 'ambassadors', code));
        if (snap.exists() && snap.data()?.active !== false) {
          await addDoc(collection(db, 'ambassadors', code, 'clicks'), {
            ts: serverTimestamp(),
            platform: device,
            userAgent: navigator.userAgent.slice(0, 256),
          });
        }
      } catch {
        // Network/Firestore errors don't matter — user already redirected.
      }
    })();

    window.location.href = destination;
  }, [params]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-dark">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-teal" />
    </div>
  );
}
