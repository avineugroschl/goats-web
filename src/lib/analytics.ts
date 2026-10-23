import { sendGAEvent } from "@next/third-parties/google";

// Web mirror of the apps' unified `link_click` Firebase Analytics event
// (see AnalyticsHelper.logLinkClick on iOS/Android). Same event name and
// param names so the event-scoped custom dimensions already registered on
// the GA4 property (link_type / screen / url) apply to web hits too.
//
// link_type: which store the visitor is being sent to.
// screen:    which surface they tapped (home_badge, get_app_cta,
//            download_redirect, referral_redirect, qr_modal).
//
// `transport_type: "beacon"` makes gtag use navigator.sendBeacon so the hit
// survives the store navigation that usually follows the tap. On the pure
// redirect pages (/download, /r/[code]) the page can navigate before gtag
// has finished loading, so those hits are best-effort; the UTM params on
// the store links remain the authoritative attribution there.
export type StoreLinkType = "app_store" | "play_store" | "smart_link";
export type StoreLinkScreen =
  | "home_badge"
  | "get_app_cta"
  | "download_redirect"
  | "referral_redirect"
  | "qr_modal";

export function trackStoreClick(
  linkType: StoreLinkType,
  screen: StoreLinkScreen,
  url?: string,
) {
  if (typeof window === "undefined") return;
  try {
    sendGAEvent("event", "link_click", {
      link_type: linkType,
      screen,
      ...(url ? { url: url.slice(0, 100) } : {}),
      transport_type: "beacon",
    });
  } catch {
    // Analytics must never break a tap or a redirect.
  }
}
