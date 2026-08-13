import { describe, expect, it } from "vitest";

import type { Technician } from "@/domain/entities/technician";
import { AdminTechnicianManagementService } from "@/services/admin/admin-technician-management-service";

const pendingTechnician: Technician = {
  id: "tech-010",
  slug: "felipe-silva",
  displayName: "Felipe Silva",
  avatarUrl: null,
  city: "Recoleta",
  coverageAreas: ["Recoleta"],
  headline: "Gasfitería para hogares",
  bio: "Perfil en revisión.",
  status: "pending_verification",
  categoryIds: ["gasfiteria"],
  specialties: ["Destapes"],
  yearsOfExperience: 5,
  emergencyEnabled: false,
  startingPriceClp: 21000,
  metrics: { rating: 0, reviewCount: 0, completedJobs: 0, responseTimeMinutes: 42, completionRate: 0 },
};

describe("AdminTechnicianManagementService", () => {
  it("updates a valid technician state", () => {
    const result = new AdminTechnicianManagementService().updateStatus(pendingTechnician, "verified");
    expect(result.status).toBe("verified");
  });

  it("rejects an invalid technician state change", () => {
    expect(() => new AdminTechnicianManagementService().updateStatus(pendingTechnician, "banned")).toThrow("no está permitido");
  });
});
