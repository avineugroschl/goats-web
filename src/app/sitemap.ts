import { MetadataRoute } from "next";

const SITE = "https://www.goatssportsapp.com";

// Court detail + hub pages were removed from the web on 2026-09-22 (court
// content is app-only now; old URLs 308 to the homepage — see redirects in
// next.config.ts). Restore the court entries by reverting that commit.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE}/operator`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];
}
