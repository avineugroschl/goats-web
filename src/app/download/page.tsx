'use client';

import { useEffect, useState } from 'react';
import { APP_CONFIG, getDeviceType, buildStoreUrl } from '@/lib/app-config';

export default function DownloadRedirect() {
  const [showAndroidMessage, setShowAndroidMessage] = useState(false);

  useEffect(() => {
    const device = getDeviceType();
    const incoming = new URLSearchParams(window.location.search);
    const utmParams: Record<string, string> = {};
    for (const [key, value] of incoming.entries()) {
      if (key.startsWith('utm_')) utmParams[key] = value;
    }
    const hasUtm = Object.keys(utmParams).length > 0;

    if (device === 'ios') {
      window.location.href = hasUtm
        ? buildStoreUrl(APP_CONFIG.appStoreUrl, utmParams)
        : APP_CONFIG.appStoreUrl;
    } else if (device === 'android') {
      if (APP_CONFIG.playStoreAvailable && APP_CONFIG.playStoreUrl) {
        window.location.href = hasUtm
          ? buildStoreUrl(APP_CONFIG.playStoreUrl, utmParams)
          : APP_CONFIG.playStoreUrl;
      } else {
        setShowAndroidMessage(true);
      }
    } else {
      // Desktop → homepage where the badges live
      window.location.href = APP_CONFIG.homeUrl;
    }
  }, []);

  if (showAndroidMessage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-dark px-6">
        <div className="max-w-sm text-center">
          <img
            src="/app-icon.png"
            alt="G.O.A.T.S"
            className="mx-auto mb-6 h-20 w-20 rounded-2xl"
          />
          <h1 className="font-display mb-3 text-2xl font-bold text-white">
            Coming Soon to Android
          </h1>
          <p className="mb-8 text-white/50">
            G.O.A.T.S is currently available on iOS. Android is on the way.
          </p>
          <a
            href="/"
            className="inline-block rounded-full bg-teal px-8 py-3 font-display text-sm font-bold text-white transition-all hover:bg-teal-dark"
          >
            Visit Website
          </a>
        </div>
      </div>
    );
  }

  // Loading spinner while redirecting
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-dark">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-teal" />
    </div>
  );
}
