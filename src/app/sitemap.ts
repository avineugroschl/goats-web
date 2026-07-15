import { MetadataRoute } from "next";
import { getAllCourtsForStatic, getLocationGroups } from "@/lib/courts-data";
import { courtPath } from "@/lib/slug";

const SITE = "https://www.goatssportsapp.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [courts, groups] = await Promise.all([
    getAllCourtsForStatic(),
    getLocationGroups(),
  ]);

  const courtEntries: MetadataRoute.Sitemap = courts.map((court) => ({
    url: `${SITE}${courtPath(court)}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const hubEntries: MetadataRoute.Sitemap = groups.map((g) => ({
    url: `${SITE}/basketball-courts/${g.locationSlug}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [
    {
      url: SITE,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE}/basketball-courts`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE}/courts`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE}/operator`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...hubEntries,
    ...courtEntries,
  ];
}
