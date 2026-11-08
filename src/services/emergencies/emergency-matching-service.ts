import type { Technician } from "@/domain/entities/technician";
import type { EmergencyRequest } from "@/domain/entities/emergency-request";
import { getTechnicianRepository } from "@/repositories/repository-factory";

const MAX_CANDIDATES = 5;

/**
 * Reutiliza el repositorio de técnicos existente (ya filtra por estado
 * público y `emergencyEnabled`) en vez de duplicar reglas de negocio con un
 * `technicians.filter(...)` dentro de un componente.
 */
export class EmergencyMatchingService {
  async findCandidates(emergency: Pick<EmergencyRequest, "categoryId" | "locationLabel">): Promise<readonly Technician[]> {
    const technicians = await getTechnicianRepository().search({
      categoryId: emergency.categoryId ?? undefined,
      emergenciesOnly: true,
      sort: "response_time",
    });

    return technicians.slice(0, MAX_CANDIDATES);
  }
}
