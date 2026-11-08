import { TechnicianDirectoryService } from "@/services/technicians/technician-directory-service";

export class TechnicianDashboardService {
  async getOverview(userId: string) {
    const technician = await new TechnicianDirectoryService().getByUserId(userId);
    return technician ? { technician } : null;
  }
}
