import { describe, expect, it } from "vitest";

import { CHILE_REGIONS } from "@/domain/geo/chile-communes";
import { communeFromSlug, communeSlug } from "@/domain/geo/commune-slug";

describe("commune slugs", () => {
  it("turns names into plain URL segments and back", () => {
    expect(communeSlug("Ñuñoa")).toBe("nunoa");
    expect(communeSlug("Las Condes")).toBe("las-condes");
    expect(communeFromSlug("nunoa")).toBe("Ñuñoa");
    expect(communeFromSlug("las-condes")).toBe("Las Condes");
  });

  it("is unique across all communes, so a slug never points at the wrong place", () => {
    const slugs = CHILE_REGIONS.flatMap((region) => region.communes.map(communeSlug));
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs.every((slug) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))).toBe(true);
  });

  it("rejects what is not a commune", () => {
    expect(communeFromSlug("atlantida")).toBeNull();
    expect(communeFromSlug("")).toBeNull();
  });
});
