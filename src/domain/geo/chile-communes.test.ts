import { describe, expect, it } from "vitest";

import { CHILE_REGIONS, MAX_COVERAGE_COMMUNES, canonicalCommune, communesOfRegion, isCommune, normalizeCommune, regionOfCommune } from "./chile-communes";

describe("Chile's administrative division", () => {
  it("has the 16 regions and the 346 communes in force", () => {
    expect(CHILE_REGIONS).toHaveLength(16);
    expect(CHILE_REGIONS.reduce((sum, region) => sum + region.communes.length, 0)).toBe(346);
    expect(CHILE_REGIONS.map((region) => region.communes.length)).toEqual([4, 7, 9, 9, 15, 38, 52, 33, 30, 21, 33, 32, 12, 30, 10, 11]);
  });

  it("has no repeated commune, region id or name, and nothing blank or padded", () => {
    const all = CHILE_REGIONS.flatMap((region) => region.communes);
    expect(new Set(all.map(normalizeCommune)).size).toBe(all.length);
    expect(new Set(CHILE_REGIONS.map((region) => region.id)).size).toBe(16);
    expect(new Set(CHILE_REGIONS.map((region) => region.name)).size).toBe(16);
    for (const name of all) expect(name).toBe(name.trim().replace(/\s+/g, " "));
  });

  it("keeps every commune within the length the forms and the database accept", () => {
    for (const name of CHILE_REGIONS.flatMap((region) => region.communes)) expect(name.length).toBeLessThanOrEqual(30);
  });

  it("finds a commune whatever its case or accents, returning the official spelling", () => {
    expect(canonicalCommune("nunoa")).toBe("Ñuñoa");
    expect(canonicalCommune("  LAS   CONDES ")).toBe("Las Condes");
    expect(canonicalCommune("vina del mar")).toBe("Viña del Mar");
    expect(canonicalCommune("Santiago Centro")).toBeNull();
    expect(isCommune("Providencia")).toBe(true);
    expect(isCommune("Zona norte")).toBe(false);
    expect(isCommune("")).toBe(false);
  });

  it("knows each commune's region, including the Santiago ones from the example", () => {
    for (const name of ["Las Condes", "Providencia", "Ñuñoa", "Vitacura"]) expect(regionOfCommune(name)?.id).toBe("RM");
    expect(regionOfCommune("Viña del Mar")?.name).toBe("Valparaíso");
    expect(regionOfCommune("Atlantis")).toBeNull();
    expect(communesOfRegion("RM")).toHaveLength(52);
    expect(communesOfRegion("nope")).toEqual([]);
  });

  it("limits coverage to the number the database enforces", () => {
    expect(MAX_COVERAGE_COMMUNES).toBe(20);
  });
});
