import { getTechnicianRepository } from "@/repositories/repository-factory";

export class AdminDashboardService {
  async getOverview() {
    const technicians = await getTechnicianRepository().listForAdministration();
    const activeTechnicians = technicians.filter((technician) => technician.status === "active").length;
    const pendingVerification = technicians.filter((technician) => technician.status === "pending_verification").length;
    const restrictedTechnicians = technicians.filter((technician) => ["temporarily_suspended", "suspended", "banned"].includes(technician.status)).length;

    return {
      technicians,
      metrics: {
        activeTechnicians,
        pendingVerification,
        restrictedTechnicians,
      },
    };
  }
}
