import type { AcceptedQuoteSnapshot } from "@/domain/entities/quote";
import type { Job } from "@/domain/entities/job";
import type { Quote } from "@/domain/entities/quote";
import type { ServiceRequest } from "@/domain/entities/service-request";
import type { QuoteInput } from "@/domain/validation/quote-input";
import { getJobRepository, getQuoteRepository, getServiceRequestRepository, getTechnicianRepository } from "@/repositories/repository-factory";

export interface AcceptQuoteResult {
  readonly request: ServiceRequest;
  readonly quote: Quote;
  readonly job: Job;
}

function buildSnapshot(quote: Quote, acceptedAt: string): AcceptedQuoteSnapshot {
  return {
    quoteId: quote.id,
    serviceRequestId: quote.serviceRequestId,
    technicianId: quote.technicianId,
    priceClp: quote.priceClp,
    currency: quote.currency,
    description: quote.description,
    materialsIncluded: quote.materialsIncluded,
    materialsNotIncluded: quote.materialsNotIncluded,
    diagnosticVisit: quote.diagnosticVisit,
    estimatedDuration: quote.estimatedDuration,
    availableDate: quote.availableDate,
    conditions: quote.conditions,
    acceptedAt,
  };
}

/**
 * Orquesta las reglas de negocio de cotizaciones. Los repositorios sólo
 * garantizan invariantes locales (transiciones, unicidad de aceptación); acá
 * se valida ownership y se coordina la creación del `Job`.
 */
export class QuoteService {
  async listForServiceRequestAsCustomer(customerId: string, serviceRequestId: string): Promise<{ request: ServiceRequest; quotes: readonly Quote[] }> {
    const request = await getServiceRequestRepository().findById(serviceRequestId);
    if (!request || request.customerId !== customerId) throw new Error("No tienes acceso a esta solicitud.");
    const quotes = await getQuoteRepository().listByServiceRequest(serviceRequestId);
    return { request, quotes };
  }

  async listForTechnician(technicianId: string): Promise<readonly Quote[]> {
    return getQuoteRepository().listByTechnician(technicianId);
  }

  async createDraft(technicianId: string, input: QuoteInput): Promise<Quote> {
    const [request, technician] = await Promise.all([
      getServiceRequestRepository().findById(input.serviceRequestId),
      getTechnicianRepository().findByUserId(technicianId),
    ]);
    if (!request) throw new Error("La solicitud no existe.");
    if (!["matching", "receiving_quotes"].includes(request.status)) throw new Error("Esta solicitud ya no admite nuevas cotizaciones.");
    if (!technician) throw new Error("No encontramos tu perfil técnico.");
    if (!technician.categoryIds.includes(request.categoryId)) throw new Error("Esta solicitud no corresponde a tu rubro.");

    return getQuoteRepository().create({ ...input, technicianId });
  }

  async submitDraft(technicianId: string, quoteId: string): Promise<Quote> {
    const repository = getQuoteRepository();
    const quote = await repository.getById(quoteId);
    if (!quote) throw new Error("La cotización no existe.");
    if (quote.technicianId !== technicianId) throw new Error("No puedes modificar esta cotización.");
    return repository.submit(quoteId);
  }

  async withdraw(technicianId: string, quoteId: string): Promise<Quote> {
    const repository = getQuoteRepository();
    const quote = await repository.getById(quoteId);
    if (!quote) throw new Error("La cotización no existe.");
    if (quote.technicianId !== technicianId) throw new Error("No puedes modificar esta cotización.");
    return repository.withdraw(quoteId);
  }

  async acceptQuote(customerId: string, serviceRequestId: string, quoteId: string): Promise<AcceptQuoteResult> {
    const serviceRequestRepository = getServiceRequestRepository();
    const quoteRepository = getQuoteRepository();

    const request = await serviceRequestRepository.findById(serviceRequestId);
    if (!request) throw new Error("La solicitud no existe.");
    if (request.customerId !== customerId) throw new Error("No tienes permiso para aceptar cotizaciones de esta solicitud.");
    if (request.status !== "receiving_quotes") throw new Error("Esta solicitud ya no admite seleccionar un técnico.");

    const quote = await quoteRepository.getById(quoteId);
    if (!quote) throw new Error("La cotización no existe.");
    if (quote.serviceRequestId !== serviceRequestId) throw new Error("La cotización no pertenece a esta solicitud.");
    if (quote.status !== "submitted") throw new Error("Sólo se puede aceptar una cotización enviada.");

    const acceptedQuote = await quoteRepository.accept(quoteId);
    const updatedRequest = await serviceRequestRepository.updateStatus(serviceRequestId, "technician_selected");
    const snapshot = buildSnapshot(acceptedQuote, new Date().toISOString());
    const job = await getJobRepository().create({
      serviceRequestId,
      quoteId: acceptedQuote.id,
      emergencyId: null,
      customerId,
      technicianId: acceptedQuote.technicianId,
      status: "scheduled",
      snapshot,
    });

    return { request: updatedRequest, quote: acceptedQuote, job };
  }
}
