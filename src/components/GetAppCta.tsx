"use client";

import { useEffect, useState } from "react";
import { APP_CONFIG, getDeviceType, buildStoreUrl } from "@/lib/app-config";

// The "Get the G.O.A.T.S App" card that appears on the courts list, court
// details, and location hub pages. On desktop it pops the download QR (same
// code the home-page store badges show); on mobile it deep-links to the smart
// /download redirect so the visitor lands in the right store.
export default function GetAppCta({ className }: { className?: string }) {
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    if (!showQr) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowQr(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showQr]);

  function handleClick() {
    if (getDeviceType() === "desktop") {
      setShowQr(true);
    } else {
      window.location.href = buildStoreUrl(APP_CONFIG.smartLinkUrl, {
        utm_source: "website",
        utm_medium: "cta",
      });
    }
  }

  return (
    <>
      <div
        className={`flex flex-col gap-4 rounded-2xl bg-teal-light p-5 sm:flex-row sm:items-center ${className ?? ""}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/app-icon.png"
          alt="G.O.A.T.S"
          className="h-12 w-12 flex-shrink-0 rounded-xl"
        />
        <div className="flex-1">
          <p className="font-semibold text-teal-dark">
            See who&apos;s playing and much more
          </p>
          <p className="text-sm text-text-secondary">
            Download the app and never miss the action
          </p>
        </div>
        <button
          onClick={handleClick}
          className="flex-shrink-0 rounded-full bg-coral px-6 py-3 text-center font-semibold text-text-on-dark transition-colors hover:bg-coral-dark"
        >
          Get the G.O.A.T.S App
        </button>
      </div>

      {/* QR Code Modal — desktop only */}
      {showQr && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowQr(false)}
        >
          <div
            className="relative mx-4 max-w-xs rounded-2xl bg-surface-dark p-8 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowQr(false)}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/qr-download.png"
              alt="QR code to download G.O.A.T.S"
              className="mx-auto mb-5 h-48 w-48 rounded-xl"
            />
            <p className="text-sm text-white/60">
              Scan with your phone camera to download
            </p>
          </div>
        </div>
      )}
    </>
  );
}
