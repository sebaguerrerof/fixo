import { TechnicianDirectoryService } from "@/services/technicians/technician-directory-service";

export class TechnicianDashboardService {
  async getOverview(slug: string) {
    const technician = await new TechnicianDirectoryService().getPublicProfile(slug);
    if (!technician) return null;

    return {
      technician,
      metrics: {
        newOpportunities: 4,
        activeJobs: 2,
        monthlyRevenueClp: 486000,
      },
    };
  }
}
