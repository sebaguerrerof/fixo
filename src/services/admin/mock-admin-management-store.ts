"use client";

import type { AdminAuditEntry } from "@/domain/entities/audit-log";
import type { Technician } from "@/domain/entities/technician";
import { canTransitionTechnician, type TechnicianStatus } from "@/domain/enums/technician-status";
import { DEMO_TECHNICIANS } from "@/repositories/mock/fixtures/technicians";

// En memoria durante la sesión del navegador: suficiente para recorrer la demo.
const auditEntries: AdminAuditEntry[] = [];
let sequence = 0;

export class MockAdminManagementStore {
  async changeTechnicianStatus(technician: Technician, nextStatus: TechnicianStatus, reason: string): Promise<Technician> {
    if (!canTransitionTechnician(technician.status, nextStatus)) {
      throw new Error("Esa transición de estado no está permitida.");
    }

    const index = DEMO_TECHNICIANS.findIndex((item) => item.id === technician.id);
    if (index === -1) throw new Error("No encontramos el perfil técnico.");

    const updated: Technician = { ...DEMO_TECHNICIANS[index], status: nextStatus };
    DEMO_TECHNICIANS[index] = updated;

    sequence += 1;
    auditEntries.unshift({
      id: `audit-demo-${sequence}`,
      actorName: "Equipo Fixo (demo)",
      technicianId: technician.id,
      technicianName: technician.displayName,
      action: "technician_status_changed",
      previousStatus: technician.status,
      nextStatus,
      reason: reason.trim() || "Sin motivo especificado.",
      createdAt: new Date().toISOString(),
    });

    return updated;
  }

  async readAuditEntries(technicianId?: string): Promise<AdminAuditEntry[]> {
    return technicianId ? auditEntries.filter((entry) => entry.technicianId === technicianId) : [...auditEntries];
  }
}
