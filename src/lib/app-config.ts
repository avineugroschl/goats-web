export const APP_CONFIG = {
  appStoreUrl: 'https://apps.apple.com/app/g-o-a-t-s/id6758734122',
  playStoreUrl: null as string | null, // TODO: set when Android launches
  playStoreAvailable: false, // flip to true on Android launch
  smartLinkUrl: 'https://goatssportsapp.com/download',
  homeUrl: 'https://goatssportsapp.com/',
};

export type DeviceType = 'ios' | 'android' | 'desktop';

export function getDeviceType(): DeviceType {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  // iPadOS reports as Macintosh but has multi-touch support
  if (
    /iPhone|iPad|iPod/.test(ua) ||
    (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua))
  ) {
    return 'ios';
  }
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

export function buildStoreUrl(
  baseUrl: string,
  utmParams: Record<string, string>,
): string {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(utmParams)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}
