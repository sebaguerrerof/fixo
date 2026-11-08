import { describe, expect, it } from "vitest";

import { getEmergencyRepository } from "@/repositories/repository-factory";
import { EmergencyService } from "@/services/emergencies/emergency-service";

describe("EmergencyService flow", () => {
  it("walks through matching, broadcasting, acceptance and confirmation to completion", async () => {
    const service = new EmergencyService();
    const emergency = await service.createEmergency("customer-emg-1", {
      description: "Se siente olor a gas en la cocina",
      locationLabel: "Ñuñoa",
    });
    expect(emergency.status).toBe("created");

    const broadcasting = await service.startMatching("customer-emg-1", emergency.id);
    expect(broadcasting.status).toBe("broadcasting");
    expect(broadcasting.candidateTechnicianIds.length).toBeGreaterThan(0);

    const [candidateId, anotherCandidateId] = broadcasting.candidateTechnicianIds;
    const accepted = await service.acceptAsTechnician(candidateId, emergency.id);
    expect(accepted.status).toBe("accepted");
    expect(accepted.assignedTechnicianId).toBe(candidateId);

    if (anotherCandidateId) {
      await expect(service.acceptAsTechnician(anotherCandidateId, emergency.id)).rejects.toThrow();
    }

    const enRoute = await service.confirmAssignment("customer-emg-1", emergency.id);
    expect(enRoute.status).toBe("technician_en_route");

    const arrived = await service.advanceAsTechnician(candidateId, emergency.id, "arrived");
    expect(arrived.status).toBe("arrived");

    const inProgress = await service.advanceAsTechnician(candidateId, emergency.id, "in_progress");
    expect(inProgress.status).toBe("in_progress");

    const completed = await service.advanceAsTechnician(candidateId, emergency.id, "completed");
    expect(completed.status).toBe("completed");
  });

  it("rejects a technician who was not among the broadcast candidates", async () => {
    const service = new EmergencyService();
    const emergency = await service.createEmergency("customer-emg-2", {
      description: "Fuga de agua en el baño",
      locationLabel: "Providencia",
    });
    await service.startMatching("customer-emg-2", emergency.id);

    await expect(service.acceptAsTechnician("tech-09", emergency.id)).rejects.toThrow();
  });

  it("rejects a suspended or emergency-disabled technician even if forced into the candidate list", async () => {
    const service = new EmergencyService();
    const emergency = await service.createEmergency("customer-emg-3", {
      description: "Cambio de cerradura urgente",
      locationLabel: "Santiago Centro",
    });
    await service.startMatching("customer-emg-3", emergency.id);
    await getEmergencyRepository().setBroadcastCandidates(emergency.id, ["tech-12"]);

    await expect(service.acceptAsTechnician("tech-12", emergency.id)).rejects.toThrow();
  });

  it("only lets one technician win the emergency", async () => {
    const service = new EmergencyService();
    const emergency = await service.createEmergency("customer-emg-4", {
      description: "Corte de electricidad total en la casa",
      locationLabel: "Ñuñoa",
    });
    const broadcasting = await service.startMatching("customer-emg-4", emergency.id);
    const [firstCandidate, secondCandidate] = broadcasting.candidateTechnicianIds;

    await service.acceptAsTechnician(firstCandidate, emergency.id);
    if (secondCandidate) {
      await expect(service.acceptAsTechnician(secondCandidate, emergency.id)).rejects.toThrow();
    }

    const stored = await getEmergencyRepository().getById(emergency.id);
    expect(stored?.assignedTechnicianId).toBe(firstCandidate);
  });
});
