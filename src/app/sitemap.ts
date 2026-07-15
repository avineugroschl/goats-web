import { MetadataRoute } from "next";
import { getAllCourtsForStatic } from "@/lib/courts-data";
import { courtPath } from "@/lib/slug";

const SITE = "https://www.goatssportsapp.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const courts = await getAllCourtsForStatic();
  const courtEntries: MetadataRoute.Sitemap = courts.map((court) => ({
    url: `${SITE}${courtPath(court)}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [
    {
      url: SITE,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
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
    ...courtEntries,
  ];
}
