import type { TechnicianStatus } from "@/domain/enums/technician-status";

export interface TechnicianMetrics {
  readonly rating: number;
  readonly reviewCount: number;
  readonly completedJobs: number;
  readonly responseTimeMinutes: number;
  readonly completionRate: number;
}

export interface Technician {
  readonly id: string;
  readonly slug: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly city: string;
  readonly coverageAreas: readonly string[];
  readonly headline: string;
  readonly bio: string;
  readonly status: TechnicianStatus;
  readonly categoryIds: readonly string[];
  readonly specialties: readonly string[];
  readonly yearsOfExperience: number;
  readonly emergencyEnabled: boolean;
  readonly startingPriceClp: number;
  readonly metrics: TechnicianMetrics;
}
