import type { Category } from "@/domain/entities/category";
import type { Technician } from "@/domain/entities/technician";
import { PUBLIC_TECHNICIAN_STATUSES } from "@/domain/enums/technician-status";
import type { TechnicianRepository, TechnicianSearchFilters } from "@/repositories/contracts/technician-repository";
import { buildDemoCategories } from "@/repositories/mock/fixtures/categories";
import { DEMO_TECHNICIANS } from "@/repositories/mock/fixtures/technicians";
import { matchesClientFilters, sortTechnicians } from "@/repositories/shared/technician-search";

const publicStatuses: readonly string[] = PUBLIC_TECHNICIAN_STATUSES;

function isPublic(technician: Technician): boolean {
  return publicStatuses.includes(technician.status);
}

export class MockTechnicianRepository implements TechnicianRepository {
  async listCategories(): Promise<readonly Category[]> {
    const counts = new Map<string, number>();
    DEMO_TECHNICIANS.filter(isPublic).forEach((technician) => {
      technician.categoryIds.forEach((categoryId) => counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1));
    });
    return buildDemoCategories(counts);
  }

  async search(filters: TechnicianSearchFilters = {}): Promise<readonly Technician[]> {
    const visible = DEMO_TECHNICIANS.filter(isPublic).filter((technician) => matchesClientFilters(technician, filters));
    return sortTechnicians(visible, filters.sort);
  }

  async findBySlug(slug: string): Promise<Technician | null> {
    return DEMO_TECHNICIANS.find((technician) => technician.slug === slug) ?? null;
  }

  async findByUserId(userId: string): Promise<Technician | null> {
    return DEMO_TECHNICIANS.find((technician) => technician.id === userId) ?? null;
  }

  async featured(limit: number): Promise<readonly Technician[]> {
    return (await this.search({ sort: "recommended" })).slice(0, limit);
  }

  async listForAdministration(): Promise<readonly Technician[]> {
    return sortTechnicians(DEMO_TECHNICIANS, "recommended");
  }
}
