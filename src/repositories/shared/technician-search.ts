import type { Technician } from "@/domain/entities/technician";
import type { TechnicianSearchFilters } from "@/repositories/contracts/technician-repository";

function normalise(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function sortTechnicians(technicians: readonly Technician[], sort: TechnicianSearchFilters["sort"]): Technician[] {
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
      return list.sort(
        (left, right) =>
          right.metrics.rating * 25 + right.metrics.completionRate - right.metrics.responseTimeMinutes / 10 -
          (left.metrics.rating * 25 + left.metrics.completionRate - left.metrics.responseTimeMinutes / 10),
      );
  }
}

export function matchesClientFilters(technician: Technician, filters: TechnicianSearchFilters): boolean {
  if (filters.query) {
    const haystack = normalise([technician.displayName, technician.headline, technician.city, ...technician.specialties].join(" "));
    if (!haystack.includes(normalise(filters.query))) return false;
  }
  if (filters.categoryId && !technician.categoryIds.includes(filters.categoryId)) return false;
  if (filters.city && !normalise(technician.coverageAreas.join(" ")).includes(normalise(filters.city))) return false;
  if (filters.emergenciesOnly && !technician.emergencyEnabled) return false;
  if (filters.minimumRating && technician.metrics.rating < filters.minimumRating) return false;
  return true;
}
