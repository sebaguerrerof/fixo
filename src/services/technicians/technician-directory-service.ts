import type { Technician } from "@/domain/entities/technician";
import type { TechnicianSearchFilters } from "@/repositories/contracts/technician-repository";
import { getTechnicianRepository } from "@/repositories/repository-factory";

export class TechnicianDirectoryService {
  async listCategories() {
    return getTechnicianRepository().listCategories();
  }

  async search(filters: TechnicianSearchFilters = {}) {
    return getTechnicianRepository().search(filters);
  }

  async getPublicProfile(slug: string): Promise<Technician | null> {
    return getTechnicianRepository().findBySlug(slug);
  }

  async getByUserId(userId: string): Promise<Technician | null> {
    return getTechnicianRepository().findByUserId(userId);
  }

  async getFeaturedTechnicians(limit = 3) {
    return getTechnicianRepository().featured(limit);
  }

  async getAdministrationList() {
    return getTechnicianRepository().listForAdministration();
  }
}
