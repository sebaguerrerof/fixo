import type { Category } from "@/domain/entities/category";
import type { Technician } from "@/domain/entities/technician";

export type TechnicianSort = "recommended" | "rating" | "experience" | "response_time";

export interface TechnicianSearchFilters {
  readonly query?: string;
  readonly categoryId?: string;
  readonly city?: string;
  readonly emergenciesOnly?: boolean;
  readonly verifiedOnly?: boolean;
  readonly minimumRating?: number;
  readonly sort?: TechnicianSort;
}

export interface TechnicianRepository {
  listCategories(): Promise<readonly Category[]>;
  search(filters?: TechnicianSearchFilters): Promise<readonly Technician[]>;
  findBySlug(slug: string): Promise<Technician | null>;
  featured(limit: number): Promise<readonly Technician[]>;
  listForAdministration(): Promise<readonly Technician[]>;
}
