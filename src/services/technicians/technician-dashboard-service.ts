import { TechnicianDirectoryService } from "@/services/technicians/technician-directory-service";

export class TechnicianDashboardService {
  async getOverview(userId: string) {
    const technician = await new TechnicianDirectoryService().getByUserId(userId);
    if (!technician) return null;

    return {
      technician,
      metrics: {
        newOpportunities: 0,
        activeJobs: 0,
        monthlyRevenueClp: 0,
      },
    };
  }
}
