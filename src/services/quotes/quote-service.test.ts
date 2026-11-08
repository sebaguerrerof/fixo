import { describe, expect, it } from "vitest";

import type { Quote } from "@/domain/entities/quote";
import type { ServiceRequest } from "@/domain/entities/service-request";
import { getQuoteRepository, getServiceRequestRepository } from "@/repositories/repository-factory";
import { QuoteService } from "@/services/quotes/quote-service";

async function createReceivingQuotesRequest(customerId: string): Promise<ServiceRequest> {
  const repository = getServiceRequestRepository();
  const request = await repository.create({
    customerId,
    title: "Solicitud de prueba para cotizaciones",
    categoryId: "cat-electricidad",
    description: "Descripción de prueba con suficiente longitud para pasar la validación.",
    locationLabel: "Santiago",
    priority: "standard",
    scheduledFor: null,
  });
  await repository.updateStatus(request.id, "matching");
  return repository.updateStatus(request.id, "receiving_quotes");
}

async function createSubmittedQuote(serviceRequestId: string, technicianId: string, priceClp = 20000): Promise<Quote> {
  const repository = getQuoteRepository();
  const quote = await repository.create({
    serviceRequestId,
    technicianId,
    priceClp,
    description: "Descripción de la cotización de prueba, con detalle suficiente.",
    materialsIncluded: "",
    materialsNotIncluded: "",
    diagnosticVisit: false,
    estimatedDuration: "1 hora",
    availableDate: new Date().toISOString(),
    conditions: "",
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  });
  return repository.submit(quote.id);
}

describe("QuoteService.acceptQuote", () => {
  it("accepts a submitted quote, rejects siblings, creates a job and marks the request technician_selected", async () => {
    const request = await createReceivingQuotesRequest("customer-test-1");
    const quoteA = await createSubmittedQuote(request.id, "tech-01");
    const quoteB = await createSubmittedQuote(request.id, "tech-05");

    const result = await new QuoteService().acceptQuote("customer-test-1", request.id, quoteA.id);

    expect(result.quote.status).toBe("accepted");
    expect(result.request.status).toBe("technician_selected");
    expect(result.job.technicianId).toBe("tech-01");
    expect(result.job.snapshot?.priceClp).toBe(quoteA.priceClp);

    const siblingAfter = await getQuoteRepository().getById(quoteB.id);
    expect(siblingAfter?.status).toBe("rejected");
  });

  it("rejects accepting a quote that is not submitted", async () => {
    const request = await createReceivingQuotesRequest("customer-test-2");
    const quote = await createSubmittedQuote(request.id, "tech-02");
    await new QuoteService().acceptQuote("customer-test-2", request.id, quote.id);

    await expect(new QuoteService().acceptQuote("customer-test-2", request.id, quote.id)).rejects.toThrow();
  });

  it("rejects a customer accepting another customer's request", async () => {
    const request = await createReceivingQuotesRequest("customer-test-3");
    const quote = await createSubmittedQuote(request.id, "tech-03");

    await expect(new QuoteService().acceptQuote("someone-else", request.id, quote.id)).rejects.toThrow();
  });

  it("rejects accepting a quote that belongs to a different service request", async () => {
    const requestA = await createReceivingQuotesRequest("customer-test-4");
    const requestB = await createReceivingQuotesRequest("customer-test-4");
    const quoteFromB = await createSubmittedQuote(requestB.id, "tech-04");

    await expect(new QuoteService().acceptQuote("customer-test-4", requestA.id, quoteFromB.id)).rejects.toThrow();
  });
});
