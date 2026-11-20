import { CHILE_REGIONS, normalizeCommune } from "@/domain/geo/chile-communes";

/** URL segment of a commune: lowercase, no accents, hyphens ("Ñuñoa" → "nunoa", "Las Condes" → "las-condes"). */
export function communeSlug(name: string): string {
  return normalizeCommune(name).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const bySlug = new Map(CHILE_REGIONS.flatMap((region) => region.communes.map((name) => [communeSlug(name), name] as const)));

/** The official commune for a URL segment, or null when it is not one. */
export function communeFromSlug(slug: string): string | null {
  return bySlug.get(slug) ?? null;
}
