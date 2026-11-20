import type { MetadataRoute } from "next";

import { CHILE_REGIONS } from "@/domain/geo/chile-communes";
import { communeSlug } from "@/domain/geo/commune-slug";
import { brand } from "@/design-system/brand";
import { TechnicianDirectoryService } from "@/services/technicians/technician-directory-service";

// Categories come from the database, so this is built per request, not at build time.
export const dynamic = "force-dynamic";

/** Public pages for search engines: the home, the service catalog, every service and every service in every commune. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = brand.url.replace(/\/$/, "");
  const categories = await new TechnicianDirectoryService().listCategories();
  const communes = CHILE_REGIONS.flatMap((region) => region.communes.map(communeSlug));
  return [
    ...["", "/servicios", "/tecnicos", "/como-funciona"].map((path) => ({ url: `${base}${path}` })),
    ...categories.map((category) => ({ url: `${base}/servicios/${category.slug}` })),
    ...categories.flatMap((category) => communes.map((slug) => ({ url: `${base}/servicios/${category.slug}/${slug}` }))),
  ];
}
