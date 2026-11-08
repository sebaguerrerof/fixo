import type { ServiceRequest } from "@/domain/entities/service-request";
import type { Quote } from "@/domain/entities/quote";
import { getQuoteRepository, getServiceRequestRepository, getTechnicianRepository } from "@/repositories/repository-factory";

export interface TechnicianOpportunity {
  readonly request: ServiceRequest;
  readonly existingQuote: Quote | null;
}

/** Solicitudes abiertas compatibles con el rubro y la cobertura del técnico autenticado. */
export class TechnicianOpportunitiesService {
  async listOpportunities(technicianId: string): Promise<readonly TechnicianOpportunity[]> {
    const technician = await getTechnicianRepository().findByUserId(technicianId);
    if (!technician) return [];

    const requestRepository = getServiceRequestRepository();
    const requestLists = await Promise.all(technician.categoryIds.map((categoryId) => requestRepository.listOpenForCategory(categoryId)));
    const requests = new Map<string, ServiceRequest>();
    requestLists.flat().forEach((request) => requests.set(request.id, request));

    const ownQuotes = await getQuoteRepository().listByTechnician(technicianId);
    const quoteByRequest = new Map(ownQuotes.map((quote) => [quote.serviceRequestId, quote]));

    return [...requests.values()]
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .map((request) => ({ request, existingQuote: quoteByRequest.get(request.id) ?? null }));
  }
}
