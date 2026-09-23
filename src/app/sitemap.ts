import { MetadataRoute } from "next";
import { getAllCourtsForStatic, getLocationGroups } from "@/lib/courts-data";
import { courtPath } from "@/lib/slug";

const SITE = "https://www.goatssportsapp.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // One collection read: getLocationGroups used to call
  // getAllCourtsForStatic() again internally, doubling the Firestore reads
  // per sitemap render.
  const courts = await getAllCourtsForStatic();
  const groups = await getLocationGroups(courts);

  // No lastModified on purpose: court docs carry no updatedAt field, and
  // stamping every URL "changed now" on every regeneration teaches crawlers
  // to ignore the signal — worse than omitting it. Revisit if updatedAt is
  // ever added to court docs.
  const courtEntries: MetadataRoute.Sitemap = courts.map((court) => ({
    url: `${SITE}${courtPath(court)}`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const hubEntries: MetadataRoute.Sitemap = groups.map((g) => ({
    url: `${SITE}/basketball-courts/${g.locationSlug}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [
    {
      url: SITE,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE}/basketball-courts`,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE}/courts`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE}/operator`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...hubEntries,
    ...courtEntries,
  ];
}
