import type { AdminAuditEntry } from "@/domain/entities/audit-log";
import type { Technician } from "@/domain/entities/technician";
import type { TechnicianStatus } from "@/domain/enums/technician-status";
import { AdminTechnicianManagementService } from "@/services/admin/admin-technician-management-service";

const statusStorageKey = "fixo.admin.technician-statuses";
const auditStorageKey = "fixo.admin.audit-entries";

type StatusOverrides = Record<string, TechnicianStatus>;

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  try {
    const rawValue = window.localStorage.getItem(key);
    return rawValue ? (JSON.parse(rawValue) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export class LocalAdminManagementStore {
  hydrateTechnicians(technicians: readonly Technician[]): Technician[] {
    const overrides = readJson<StatusOverrides>(statusStorageKey, {});
    return technicians.map((technician) => overrides[technician.id] ? { ...technician, status: overrides[technician.id] } : technician);
  }

  readAuditEntries(): AdminAuditEntry[] {
    return readJson<AdminAuditEntry[]>(auditStorageKey, []);
  }

  changeTechnicianStatus(
    technician: Technician,
    nextStatus: TechnicianStatus,
    reason: string,
  ): { technician: Technician; auditEntry: AdminAuditEntry } {
    const service = new AdminTechnicianManagementService();
    const updatedTechnician = service.updateStatus(technician, nextStatus);
    const auditEntry = service.createAuditEntry(technician, nextStatus, reason);
    const overrides = readJson<StatusOverrides>(statusStorageKey, {});
    writeJson(statusStorageKey, { ...overrides, [technician.id]: nextStatus });
    writeJson(auditStorageKey, [auditEntry, ...this.readAuditEntries()]);

    return { technician: updatedTechnician, auditEntry };
  }
}
