import type { EmergencyRequest, EmergencyStatusEvent } from "@/domain/entities/emergency-request";
import { canTransitionEmergency, type EmergencyStatus } from "@/domain/enums/emergency-status";
import type { CreateEmergencyInput, EmergencyActor, EmergencyRepository } from "@/repositories/contracts/emergency-repository";

const emergencies: EmergencyRequest[] = [];
const history: EmergencyStatusEvent[] = [];
let sequence = 0;

function requireEmergency(id: string): EmergencyRequest {
  const emergency = emergencies.find((item) => item.id === id);
  if (!emergency) throw new Error("No encontramos la urgencia.");
  return emergency;
}

function replaceEmergency(next: EmergencyRequest): EmergencyRequest {
  const index = emergencies.findIndex((item) => item.id === next.id);
  emergencies[index] = next;
  return next;
}

function recordHistory(emergencyId: string, fromStatus: EmergencyStatus | null, toStatus: EmergencyStatus, actor: EmergencyActor, metadata?: Record<string, unknown>): void {
  history.push({ emergencyId, fromStatus, toStatus, actorId: actor.id, actorRole: actor.role, timestamp: new Date().toISOString(), metadata });
}

export class MockEmergencyRepository implements EmergencyRepository {
  async getById(id: string): Promise<EmergencyRequest | null> {
    return emergencies.find((emergency) => emergency.id === id) ?? null;
  }

  async listForCustomer(customerId: string): Promise<readonly EmergencyRequest[]> {
    return emergencies
      .filter((emergency) => emergency.customerId === customerId)
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  }

  async listBroadcastingForTechnician(technicianId: string): Promise<readonly EmergencyRequest[]> {
    return emergencies
      .filter((emergency) => emergency.status === "broadcasting" && emergency.candidateTechnicianIds.includes(technicianId))
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  }

  async create(input: CreateEmergencyInput): Promise<EmergencyRequest> {
    sequence += 1;
    const now = new Date().toISOString();
    const emergency: EmergencyRequest = {
      id: `emergency-demo-${sequence}`,
      customerId: input.customerId,
      categoryId: input.categoryId,
      description: input.description,
      locationLabel: input.locationLabel,
      status: "created",
      assignedTechnicianId: null,
      candidateTechnicianIds: [],
      aiAssessment: input.aiAssessment,
      jobId: null,
      createdAt: now,
      updatedAt: now,
    };
    emergencies.unshift(emergency);
    recordHistory(emergency.id, null, "created", { id: input.customerId, role: "customer" });
    return emergency;
  }

  async transition(id: string, next: EmergencyStatus, actor: EmergencyActor, metadata?: Record<string, unknown>): Promise<EmergencyRequest> {
    const emergency = requireEmergency(id);
    if (!canTransitionEmergency(emergency.status, next)) {
      throw new Error(`No se puede pasar la urgencia de "${emergency.status}" a "${next}".`);
    }
    const updated = replaceEmergency({ ...emergency, status: next, updatedAt: new Date().toISOString() });
    recordHistory(id, emergency.status, next, actor, metadata);
    return updated;
  }

  async setBroadcastCandidates(id: string, technicianIds: readonly string[]): Promise<EmergencyRequest> {
    const emergency = requireEmergency(id);
    return replaceEmergency({ ...emergency, candidateTechnicianIds: technicianIds, updatedAt: new Date().toISOString() });
  }

  async acceptEmergency(id: string, technicianId: string): Promise<EmergencyRequest> {
    const emergency = requireEmergency(id);
    if (emergency.status !== "broadcasting") {
      throw new Error("Esta urgencia ya no está disponible para ser aceptada.");
    }
    // Sin `await` entre la comprobación de estado y la escritura: en Node no hay
    // interleaving posible aquí, por lo que un segundo técnico no puede adjudicarse
    // la misma urgencia (simula la atomicidad requerida para Supabase vía RPC).
    const updated = replaceEmergency({ ...emergency, status: "accepted", assignedTechnicianId: technicianId, updatedAt: new Date().toISOString() });
    recordHistory(id, "broadcasting", "accepted", { id: technicianId, role: "technician" });
    return updated;
  }

  async linkJob(id: string, jobId: string): Promise<EmergencyRequest> {
    const emergency = requireEmergency(id);
    return replaceEmergency({ ...emergency, jobId, updatedAt: new Date().toISOString() });
  }

  async listHistory(id: string): Promise<readonly EmergencyStatusEvent[]> {
    return history.filter((event) => event.emergencyId === id);
  }
}
