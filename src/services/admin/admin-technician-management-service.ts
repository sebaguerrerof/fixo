import type { AdminAuditEntry } from "@/domain/entities/audit-log";
import type { Technician } from "@/domain/entities/technician";
import { canTransitionTechnician, type TechnicianStatus } from "@/domain/enums/technician-status";

export class AdminTechnicianManagementService {
  updateStatus(technician: Technician, nextStatus: TechnicianStatus): Technician {
    if (!canTransitionTechnician(technician.status, nextStatus)) {
      throw new Error("Ese cambio de estado no está permitido para este técnico.");
    }

    return { ...technician, status: nextStatus };
  }

  createAuditEntry(
    technician: Technician,
    nextStatus: TechnicianStatus,
    reason: string,
    actorName: string,
  ): AdminAuditEntry {
    return {
      id: `${technician.id}-${Date.now()}`,
      actorName,
      technicianId: technician.id,
      technicianName: technician.displayName,
      action: "technician_status_changed",
      previousStatus: technician.status,
      nextStatus,
      reason: reason.trim() || "Cambio de estado desde administración.",
      createdAt: new Date().toISOString(),
    };
  }
}
