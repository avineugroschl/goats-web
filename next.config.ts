import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
    ],
  },
  // Court pages were removed from the web 2026-09-22 (app-only now). A
  // permanent redirect to the homepage deindexes the old URLs (Google
  // treats mass redirect-to-home as "page gone") while still landing
  // humans with old links somewhere useful. :path* also matches the bare
  // /courts and /basketball-courts URLs.
  async redirects() {
    return [
      {
        source: "/courts/:path*",
        destination: "/",
        permanent: true,
      },
      {
        source: "/basketball-courts/:path*",
        destination: "/",
        permanent: true,
      },
    ];
  },
  // Keep the raw *.vercel.app deployment URL out of Google's index so it
  // can't be crawled as a duplicate of www.goatssportsapp.com. Only the
  // vercel.app host gets noindex; the real domain stays fully indexable.
  async headers() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "goats-web.vercel.app" }],
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
