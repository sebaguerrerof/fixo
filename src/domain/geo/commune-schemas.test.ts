import { describe, expect, it } from "vitest";

import { professionalInputSchema } from "@/domain/auth/account";
import { professionalDraftSchema } from "@/domain/technicians/application";
import { technicianRegistrationInputSchema } from "@/integrations/auth/auth-provider";

import { communeSchema, coverageCsvSchema, coverageListSchema } from "./commune-schemas";

describe("commune schemas", () => {
  it("accepts a commune and returns its official spelling", () => {
    expect(communeSchema.parse("  nunoa ")).toBe("Ñuñoa");
    expect(communeSchema.safeParse("Santiago Centro").success).toBe(false);
    expect(communeSchema.safeParse("").success).toBe(false);
  });

  it("coverage list: official names, no repeats, at most 20, may be empty (a draft)", () => {
    expect(coverageListSchema.parse(["providencia", "Providencia", "Las Condes"])).toEqual(["Providencia", "Las Condes"]);
    expect(coverageListSchema.parse([])).toEqual([]);
    expect(coverageListSchema.safeParse(["Providencia", "Narnia"]).success).toBe(false);
    const twentyOne = ["Alhué", "Buin", "Calera de Tango", "Cerrillos", "Cerro Navia", "Colina", "Conchalí", "Curacaví", "El Bosque", "El Monte", "Estación Central", "Huechuraba", "Independencia", "Isla de Maipo", "La Cisterna", "La Florida", "La Granja", "La Pintana", "La Reina", "Lampa", "Las Condes"];
    expect(coverageListSchema.safeParse(twentyOne).success).toBe(false);
    expect(coverageListSchema.safeParse(twentyOne.slice(0, 20)).success).toBe(true);
  });

  it("coverage text: comma-separated official names, normalized, at least one", () => {
    expect(coverageCsvSchema.parse("providencia, NUNOA , Vitacura")).toBe("Providencia, Ñuñoa, Vitacura");
    expect(coverageCsvSchema.safeParse("").success).toBe(false);
    expect(coverageCsvSchema.safeParse(" , ").success).toBe(false);
    expect(coverageCsvSchema.safeParse("Providencia, Zona norte").success).toBe(false);
  });
});

describe("the three places that take a technician's location use the official list", () => {
  const registration = { firstName: "Ana", lastName: "Pérez", email: "ana@ejemplo.cl", phone: "+56 9 1111 2222", password: "ClaveSegura123", confirmPassword: "ClaveSegura123", acceptTerms: true, categoryIds: ["electricidad"] };

  it("registration", () => {
    expect(technicianRegistrationInputSchema.parse({ ...registration, city: "providencia", coverageAreas: "providencia, nunoa" })).toMatchObject({ city: "Providencia", coverageAreas: "Providencia, Ñuñoa" });
    expect(technicianRegistrationInputSchema.safeParse({ ...registration, city: "Marte", coverageAreas: "Providencia" }).success).toBe(false);
    expect(technicianRegistrationInputSchema.safeParse({ ...registration, city: "Providencia", coverageAreas: "Marte" }).success).toBe(false);
  });

  it("profile update", () => {
    expect(professionalInputSchema.parse({ city: "Providencia", headline: "", bio: "", coverageAreas: "Providencia, Vitacura", categoryIds: ["electricidad"] }).coverageAreas).toBe("Providencia, Vitacura");
    expect(professionalInputSchema.safeParse({ city: "Providencia", headline: "", bio: "", coverageAreas: "Barrio alto", categoryIds: ["electricidad"] }).success).toBe(false);
  });

  it("professional application draft", () => {
    const draft = { city: "Providencia", headline: "", bio: "", coverage: ["Providencia", "Ñuñoa"], categories: ["electricidad"], primaryCategory: "electricidad", specialties: [], years: 3, price: 0, availability: "", portfolio: [] };
    expect(professionalDraftSchema.parse(draft).coverage).toEqual(["Providencia", "Ñuñoa"]);
    expect(professionalDraftSchema.safeParse({ ...draft, coverage: ["Providencia", "Zona norte"] }).success).toBe(false);
    expect(professionalDraftSchema.safeParse({ ...draft, city: "Zona norte" }).success).toBe(false);
  });
});
