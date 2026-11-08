import type { AiAssessment } from "@/integrations/ai/ai-provider";
import type { EmergencyRequest, EmergencyStatusEvent } from "@/domain/entities/emergency-request";
import type { EmergencyStatus } from "@/domain/enums/emergency-status";

export interface CreateEmergencyInput {
  readonly customerId: string;
  readonly categoryId: string | null;
  readonly description: string;
  readonly locationLabel: string;
  readonly aiAssessment: AiAssessment | null;
}

export interface EmergencyActor {
  readonly id: string;
  readonly role: "customer" | "technician" | "moderator" | "superadmin" | "system";
}

export interface EmergencyRepository {
  getById(id: string): Promise<EmergencyRequest | null>;
  listForCustomer(customerId: string): Promise<readonly EmergencyRequest[]>;
  /** Urgencias en "broadcasting" donde el técnico figura como candidato convocado. */
  listBroadcastingForTechnician(technicianId: string): Promise<readonly EmergencyRequest[]>;
  create(input: CreateEmergencyInput): Promise<EmergencyRequest>;
  /** Transición genérica validada por `canTransitionEmergency`, registra historial. */
  transition(id: string, next: EmergencyStatus, actor: EmergencyActor, metadata?: Record<string, unknown>): Promise<EmergencyRequest>;
  setBroadcastCandidates(id: string, technicianIds: readonly string[]): Promise<EmergencyRequest>;
  /**
   * Adjudica la urgencia a un único técnico. Debe comprobar `status === "broadcasting"`
   * antes de asignar, como una única operación lógica (evita doble adjudicación).
   */
  acceptEmergency(id: string, technicianId: string): Promise<EmergencyRequest>;
  linkJob(id: string, jobId: string): Promise<EmergencyRequest>;
  listHistory(id: string): Promise<readonly EmergencyStatusEvent[]>;
}
