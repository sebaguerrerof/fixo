"use server";

import { isDemoModeEnabled } from "@/config/demo-mode";
import type { EmergencyRequest } from "@/domain/entities/emergency-request";
import type { Technician } from "@/domain/entities/technician";
import { emergencyInputSchema, type EmergencyInput } from "@/domain/validation/emergency-input";
import { getTechnicianRepository } from "@/repositories/repository-factory";
import { getServerAuthenticatedUser } from "@/services/auth/server-authentication-service";
import { EmergencyService } from "@/services/emergencies/emergency-service";

export interface EmergencyActionResult {
  readonly ok: boolean;
  readonly message?: string;
  readonly emergency?: EmergencyRequest;
}

async function requireCustomerId(): Promise<string | null> {
  const user = await getServerAuthenticatedUser();
  return user?.role === "customer" ? user.id : null;
}

function toResult(promise: Promise<EmergencyRequest>): Promise<EmergencyActionResult> {
  return promise
    .then((emergency) => ({ ok: true, emergency }) satisfies EmergencyActionResult)
    .catch((error: unknown) => ({ ok: false, message: error instanceof Error ? error.message : "Ocurrió un error inesperado." }) satisfies EmergencyActionResult);
}

export async function createEmergencyAction(input: EmergencyInput): Promise<EmergencyActionResult> {
  const customerId = await requireCustomerId();
  if (!customerId) return { ok: false, message: "unauthenticated" };

  const parsed = emergencyInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Cuéntanos con un poco más de detalle lo que está pasando." };

  return toResult(new EmergencyService().createEmergency(customerId, parsed.data));
}

export async function startMatchingAction(emergencyId: string): Promise<EmergencyActionResult> {
  const customerId = await requireCustomerId();
  if (!customerId) return { ok: false, message: "unauthenticated" };
  return toResult(new EmergencyService().startMatching(customerId, emergencyId));
}

export async function confirmAssignmentAction(emergencyId: string): Promise<EmergencyActionResult> {
  const customerId = await requireCustomerId();
  if (!customerId) return { ok: false, message: "unauthenticated" };
  return toResult(new EmergencyService().confirmAssignment(customerId, emergencyId));
}

export async function cancelEmergencyAction(emergencyId: string): Promise<EmergencyActionResult> {
  const customerId = await requireCustomerId();
  if (!customerId) return { ok: false, message: "unauthenticated" };
  return toResult(new EmergencyService().cancel(customerId, "customer", emergencyId));
}

export async function refreshEmergencyAction(emergencyId: string): Promise<EmergencyActionResult> {
  const customerId = await requireCustomerId();
  if (!customerId) return { ok: false, message: "unauthenticated" };
  try {
    const emergency = await new EmergencyService().getForCustomer(customerId, emergencyId);
    return { ok: true, emergency };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No pudimos actualizar el estado." };
  }
}

export async function getAssignedTechnicianAction(technicianId: string): Promise<Technician | null> {
  return getTechnicianRepository().findByUserId(technicianId);
}

/**
 * Atajo exclusivo de demo: no existe una segunda sesión de técnico disponible en este
 * flujo, así que este botón simula que el primer candidato convocado acepta la urgencia.
 * Sólo debe ofrecerse cuando el modo demo está activo.
 */
export async function simulateTechnicianAcceptanceAction(emergencyId: string): Promise<EmergencyActionResult> {
  if (!isDemoModeEnabled()) return { ok: false, message: "Esta acción sólo está disponible en modo demo." };
  const customerId = await requireCustomerId();
  if (!customerId) return { ok: false, message: "unauthenticated" };

  const service = new EmergencyService();
  const emergency = await service.getForCustomer(customerId, emergencyId);
  const candidateId = emergency.candidateTechnicianIds[0];
  if (!candidateId) return { ok: false, message: "Todavía no hay técnicos candidatos para esta urgencia." };

  return toResult(service.acceptAsTechnician(candidateId, emergencyId));
}
