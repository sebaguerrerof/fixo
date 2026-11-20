import { describe, expect, it } from "vitest";

import { MockTechnicianRepository } from "@/repositories/mock/mock-technician-repository";

describe("MockTechnicianRepository", () => {
  it("exposes at least 12 technicians to administration", async () => {
    const technicians = await new MockTechnicianRepository().listForAdministration();
    expect(technicians.length).toBeGreaterThanOrEqual(12);
  });

  it("only surfaces verified or active technicians in public search", async () => {
    const technicians = await new MockTechnicianRepository().search();
    expect(technicians.length).toBeGreaterThan(0);
    expect(technicians.every((technician) => ["verified", "active"].includes(technician.status))).toBe(true);
  });

  it("excludes a suspended technician from public search but keeps it for administration", async () => {
    const repository = new MockTechnicianRepository();
    const publicResults = await repository.search();
    const adminResults = await repository.listForAdministration();
    expect(publicResults.some((technician) => technician.status === "temporarily_suspended")).toBe(false);
    expect(adminResults.some((technician) => technician.status === "temporarily_suspended")).toBe(true);
  });

  it("filters by commune exactly, ignoring accents and case", async () => {
    const repository = new MockTechnicianRepository();
    const all = await repository.search();
    const commune = all[0]!.coverageAreas[0]!;
    const found = await repository.search({ city: commune.toUpperCase() });
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((technician) => [technician.city, ...technician.coverageAreas].some((area) => area.toLowerCase() === commune.toLowerCase()))).toBe(true);
    expect(await repository.search({ city: "Atlántida" })).toHaveLength(0);
    expect(await repository.search({ city: commune.slice(0, 3) })).toHaveLength(0);
  });

  it("filters by category id", async () => {
    const technicians = await new MockTechnicianRepository().search({ categoryId: "cat-gasfiteria" });
    expect(technicians.length).toBeGreaterThan(0);
    expect(technicians.every((technician) => technician.categoryIds.includes("cat-gasfiteria"))).toBe(true);
  });

  it("sorts by rating when requested", async () => {
    const technicians = await new MockTechnicianRepository().search({ sort: "rating" });
    const ratings = technicians.map((technician) => technician.metrics.rating);
    expect(ratings).toEqual([...ratings].sort((left, right) => right - left));
  });

  it("returns categories with technician counts derived from public technicians", async () => {
    const categories = await new MockTechnicianRepository().listCategories();
    expect(categories.length).toBeGreaterThan(0);
    expect(categories.reduce((total, category) => total + category.technicianCount, 0)).toBeGreaterThan(0);
  });
});
