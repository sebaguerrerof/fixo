import type { EmergencyRequest, EmergencyStatusEvent } from "@/domain/entities/emergency-request";
import type { EmergencyStatus } from "@/domain/enums/emergency-status";
import type { CreateEmergencyInput, EmergencyActor, EmergencyRepository } from "@/repositories/contracts/emergency-repository";

const NOT_IMPLEMENTED = "Esta función todavía no está disponible en Fixo.";

/**
 * La adjudicación atómica (`acceptEmergency`) deberá implementarse en Supabase
 * mediante una función/RPC con `update ... where status = 'broadcasting'` para
 * evitar que dos técnicos se adjudiquen la misma urgencia.
 */
export class SupabaseEmergencyRepository implements EmergencyRepository {
  async getById(_id: string): Promise<EmergencyRequest | null> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async listForCustomer(_customerId: string): Promise<readonly EmergencyRequest[]> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async listBroadcastingForTechnician(_technicianId: string): Promise<readonly EmergencyRequest[]> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async create(_input: CreateEmergencyInput): Promise<EmergencyRequest> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async transition(_id: string, _next: EmergencyStatus, _actor: EmergencyActor, _metadata?: Record<string, unknown>): Promise<EmergencyRequest> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async setBroadcastCandidates(_id: string, _technicianIds: readonly string[]): Promise<EmergencyRequest> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async acceptEmergency(_id: string, _technicianId: string): Promise<EmergencyRequest> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async linkJob(_id: string, _jobId: string): Promise<EmergencyRequest> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async listHistory(_id: string): Promise<readonly EmergencyStatusEvent[]> {
    throw new Error(NOT_IMPLEMENTED);
  }
}
