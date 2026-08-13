import type { Technician } from "@/domain/entities/technician";
import type {
  TechnicianRepository,
  TechnicianSearchFilters,
} from "@/repositories/contracts/technician-repository";
import { sampleCategories, sampleTechnicians } from "@/repositories/mock/fixture-data";

function normalise(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function matchesQuery(technician: Technician, query: string): boolean {
  const haystack = [
    technician.displayName,
    technician.headline,
    technician.city,
    ...technician.specialties,
  ].map(normalise).join(" ");

  return haystack.includes(normalise(query));
}

function sortTechnicians(technicians: readonly Technician[], sort: TechnicianSearchFilters["sort"]): Technician[] {
  const list = [...technicians];

  switch (sort) {
    case "rating":
      return list.sort((left, right) => right.metrics.rating - left.metrics.rating);
    case "experience":
      return list.sort((left, right) => right.yearsOfExperience - left.yearsOfExperience);
    case "response_time":
      return list.sort((left, right) => left.metrics.responseTimeMinutes - right.metrics.responseTimeMinutes);
    case "recommended":
    case undefined:
      return list.sort((left, right) => {
        const leftScore = left.metrics.rating * 25 + left.metrics.completionRate - left.metrics.responseTimeMinutes / 10;
        const rightScore = right.metrics.rating * 25 + right.metrics.completionRate - right.metrics.responseTimeMinutes / 10;
        return rightScore - leftScore;
      });
  }
}

export class MockTechnicianRepository implements TechnicianRepository {
  async listCategories() {
    return sampleCategories;
  }

  async search(filters: TechnicianSearchFilters = {}) {
    const technicians = sampleTechnicians.filter((technician) => {
      if (filters.query && !matchesQuery(technician, filters.query)) return false;
      if (filters.categoryId && !technician.categoryIds.includes(filters.categoryId)) return false;
      if (filters.city && !normalise(technician.coverageAreas.join(" ")).includes(normalise(filters.city))) return false;
      if (filters.emergenciesOnly && !technician.emergencyEnabled) return false;
      if (filters.verifiedOnly && !["verified", "active"].includes(technician.status)) return false;
      if (filters.minimumRating && technician.metrics.rating < filters.minimumRating) return false;
      return technician.status === "active" || technician.status === "verified";
    });

    return sortTechnicians(technicians, filters.sort);
  }

  async findBySlug(slug: string) {
    return sampleTechnicians.find((technician) => technician.slug === slug) ?? null;
  }

  async featured(limit: number) {
    return sortTechnicians(sampleTechnicians.filter((technician) => technician.status === "active"), "recommended").slice(0, limit);
  }

  async listForAdministration() {
    return sampleTechnicians;
  }
}
