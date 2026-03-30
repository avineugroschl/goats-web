import { MetadataRoute } from "next";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const courtsSnapshot = await getDocs(collection(db, "courts"));
  const courtEntries: MetadataRoute.Sitemap = courtsSnapshot.docs.map(
    (doc) => ({
      url: `https://azazelsports.com/courts/${doc.id}`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    })
  );

  return [
    {
      url: "https://azazelsports.com",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: "https://azazelsports.com/courts",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    ...courtEntries,
  ];
}
