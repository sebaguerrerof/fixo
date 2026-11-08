import type { AcceptedQuoteSnapshot } from "@/domain/entities/quote";
import type { EmergencyRequest, EmergencyStatusEvent } from "@/domain/entities/emergency-request";
import { canReceiveWork } from "@/domain/enums/technician-status";
import type { EmergencyInput } from "@/domain/validation/emergency-input";
import { getAiProvider } from "@/integrations/ai/ai-provider-factory";
import { getEmergencyRepository, getJobRepository, getTechnicianRepository } from "@/repositories/repository-factory";
import { EmergencyMatchingService } from "@/services/emergencies/emergency-matching-service";

const CUSTOMER_CANCELLABLE_STATUSES = new Set(["created", "matching", "broadcasting", "accepted"]);

function buildEmergencySnapshot(emergency: EmergencyRequest, technicianId: string, acceptedAt: string): AcceptedQuoteSnapshot {
  return {
    quoteId: emergency.id,
    serviceRequestId: emergency.id,
    technicianId,
    priceClp: 0,
    currency: "CLP",
    description: emergency.description,
    materialsIncluded: "",
    materialsNotIncluded: "",
    diagnosticVisit: true,
    estimatedDuration: "Por definir en terreno",
    availableDate: acceptedAt,
    conditions: "Atención de urgencia: el precio final se confirma en terreno.",
    acceptedAt,
  };
}

/** Orquesta el flujo completo de urgencias sobre el dominio/repositorios reales. */
export class EmergencyService {
  async createEmergency(customerId: string, input: EmergencyInput): Promise<EmergencyRequest> {
    const aiAssessment = await getAiProvider().assessIssue({ description: input.description, locationLabel: input.locationLabel });
    return getEmergencyRepository().create({
      customerId,
      categoryId: aiAssessment.suggestedCategoryId,
      description: input.description,
      locationLabel: input.locationLabel,
      aiAssessment,
    });
  }

  async getForCustomer(customerId: string, emergencyId: string): Promise<EmergencyRequest> {
    const emergency = await getEmergencyRepository().getById(emergencyId);
    if (!emergency || emergency.customerId !== customerId) throw new Error("No tienes acceso a esta urgencia.");
    return emergency;
  }

  async listHistory(emergencyId: string): Promise<readonly EmergencyStatusEvent[]> {
    return getEmergencyRepository().listHistory(emergencyId);
  }

  /** Urgencias en difusión donde el técnico autenticado figura como candidato. */
  async listBroadcastingOpportunities(technicianId: string): Promise<readonly EmergencyRequest[]> {
    return getEmergencyRepository().listBroadcastingForTechnician(technicianId);
  }

  /** Avanza created → matching → broadcasting, calculando los candidatos reales. */
  async startMatching(customerId: string, emergencyId: string): Promise<EmergencyRequest> {
    const repository = getEmergencyRepository();
    const emergency = await this.getForCustomer(customerId, emergencyId);
    if (emergency.status !== "created") throw new Error("Esta urgencia ya inició la búsqueda de técnicos.");

    await repository.transition(emergencyId, "matching", { id: customerId, role: "customer" });
    const candidates = await new EmergencyMatchingService().findCandidates(emergency);
    await repository.setBroadcastCandidates(emergencyId, candidates.map((technician) => technician.id));
    return repository.transition(emergencyId, "broadcasting", { id: "system", role: "system" }, { candidateCount: candidates.length });
  }

  /** Un técnico candidato acepta: adjudicación atómica, impide doble aceptación. */
  async acceptAsTechnician(technicianId: string, emergencyId: string): Promise<EmergencyRequest> {
    const emergency = await getEmergencyRepository().getById(emergencyId);
    if (!emergency) throw new Error("La urgencia no existe.");
    if (!emergency.candidateTechnicianIds.includes(technicianId)) throw new Error("No fuiste convocado para esta urgencia.");

    const technician = await getTechnicianRepository().findByUserId(technicianId);
    if (!technician) throw new Error("No encontramos tu perfil técnico.");
    if (!canReceiveWork(technician.status)) throw new Error("Tu perfil no puede recibir trabajos en este momento.");
    if (!technician.emergencyEnabled) throw new Error("Tu perfil no tiene habilitada la atención de urgencias.");
    if (emergency.categoryId && !technician.categoryIds.includes(emergency.categoryId)) throw new Error("Esta urgencia no corresponde a tu rubro.");

    return getEmergencyRepository().acceptEmergency(emergencyId, technicianId);
  }

  /** El cliente confirma al técnico asignado: se crea el Job y comienza a moverse. */
  async confirmAssignment(customerId: string, emergencyId: string): Promise<EmergencyRequest> {
    const repository = getEmergencyRepository();
    const emergency = await this.getForCustomer(customerId, emergencyId);
    if (emergency.status !== "accepted" || !emergency.assignedTechnicianId) throw new Error("Todavía no hay un técnico confirmado para esta urgencia.");

    const acceptedAt = new Date().toISOString();
    const jobRepository = getJobRepository();
    const job = await jobRepository.create({
      serviceRequestId: emergency.id,
      quoteId: null,
      emergencyId: emergency.id,
      customerId,
      technicianId: emergency.assignedTechnicianId,
      status: "scheduled",
      snapshot: buildEmergencySnapshot(emergency, emergency.assignedTechnicianId, acceptedAt),
    });
    await repository.linkJob(emergencyId, job.id);
    // El Job nace en "scheduled"; se sincroniza de inmediato con el estado de la urgencia.
    await jobRepository.updateStatus(job.id, "technician_en_route");
    return repository.transition(emergencyId, "technician_en_route", { id: customerId, role: "customer" });
  }

  /** El técnico avanza los hitos en terreno; mantiene sincronizado el Job asociado. */
  async advanceAsTechnician(technicianId: string, emergencyId: string, next: "arrived" | "in_progress" | "completed"): Promise<EmergencyRequest> {
    const repository = getEmergencyRepository();
    const emergency = await repository.getById(emergencyId);
    if (!emergency) throw new Error("La urgencia no existe.");
    if (emergency.assignedTechnicianId !== technicianId) throw new Error("No estás asignado a esta urgencia.");

    const updated = await repository.transition(emergencyId, next, { id: technicianId, role: "technician" });
    const job = emergency.jobId ? await getJobRepository().getById(emergency.jobId) : null;
    if (job) await getJobRepository().updateStatus(job.id, next);
    return updated;
  }

  async cancel(actorId: string, actorRole: "customer" | "technician", emergencyId: string): Promise<EmergencyRequest> {
    const repository = getEmergencyRepository();
    const emergency = await repository.getById(emergencyId);
    if (!emergency) throw new Error("La urgencia no existe.");
    if (actorRole === "customer" && emergency.customerId !== actorId) throw new Error("No tienes permiso sobre esta urgencia.");
    if (!CUSTOMER_CANCELLABLE_STATUSES.has(emergency.status)) throw new Error("Esta urgencia ya no se puede cancelar.");

    const updated = await repository.transition(emergencyId, "cancelled", { id: actorId, role: actorRole });
    if (emergency.jobId) await getJobRepository().updateStatus(emergency.jobId, "cancelled");
    return updated;
  }
}
