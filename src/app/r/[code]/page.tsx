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

    const redirect = () => {
      if (device === 'ios') {
        window.location.href = buildStoreUrl(APP_CONFIG.appStoreUrl, utmParams);
      } else if (device === 'android') {
        // Play Install Referrer surfaces the `referrer` query param to the
        // app on first launch. Pass the bare code — Android side decodes
        // url-encoded value and reads it directly.
        window.location.href = buildStoreUrl(APP_CONFIG.playStoreUrl, {
          ...utmParams,
          referrer: code,
        });
      } else {
        window.location.href = APP_CONFIG.homeUrl;
      }
    };

    const logAndRedirect = async () => {
      // localStorage so iOS users can still pick up the code if they come back
      // to the site after installing (web → app handoff).
      try {
        window.localStorage.setItem('goatsReferralCode', code);
      } catch {
        // Private-mode / quota errors — non-fatal.
      }

      try {
        // Verify the code exists before writing a click. Avoids polluting
        // the DB with clicks for mistyped/fake codes.
        const snap = await getDoc(doc(db, 'ambassadors', code));
        if (snap.exists() && snap.data()?.active !== false) {
          await addDoc(collection(db, 'ambassadors', code, 'clicks'), {
            ts: serverTimestamp(),
            platform: device,
            userAgent: navigator.userAgent.slice(0, 256),
          });
        }
      } catch {
        // Network/Firestore errors don't block the redirect.
      }

      redirect();
    };

    if (code.length === 0) {
      window.location.href = APP_CONFIG.homeUrl;
      return;
    }

    void logAndRedirect();
  }, [params]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-dark">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-teal" />
    </div>
  );
}
