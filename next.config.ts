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
