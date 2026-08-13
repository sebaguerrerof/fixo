import type { TechnicianStatus } from "@/domain/enums/technician-status";

export interface AdminAuditEntry {
  readonly id: string;
  readonly actorName: string;
  readonly technicianId: string;
  readonly technicianName: string;
  readonly action: "technician_status_changed";
  readonly previousStatus: TechnicianStatus;
  readonly nextStatus: TechnicianStatus;
  readonly reason: string;
  readonly createdAt: string;
}
