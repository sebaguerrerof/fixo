import type { Quote } from "@/domain/entities/quote";
import { canTransitionQuote } from "@/domain/enums/quote-status";
import type { CreateQuoteInput, QuoteRepository, UpdateQuoteDraftInput } from "@/repositories/contracts/quote-repository";
import { DEMO_QUOTES } from "@/repositories/mock/fixtures/quotes";

// Estado en memoria del proceso: suficiente para recorrer la demo en una sesión.
const quotes: Quote[] = [...DEMO_QUOTES];
let sequence = quotes.length;

function requireQuote(id: string): Quote {
  const quote = quotes.find((item) => item.id === id);
  if (!quote) throw new Error("No encontramos la cotización.");
  return quote;
}

function replaceQuote(next: Quote): Quote {
  const index = quotes.findIndex((item) => item.id === next.id);
  quotes[index] = next;
  return next;
}

function applyTransition(quote: Quote, next: Quote["status"]): Quote {
  if (!canTransitionQuote(quote.status, next)) {
    throw new Error(`No se puede pasar la cotización de "${quote.status}" a "${next}".`);
  }
  return replaceQuote({ ...quote, status: next, updatedAt: new Date().toISOString() });
}

export class MockQuoteRepository implements QuoteRepository {
  async getById(id: string): Promise<Quote | null> {
    return quotes.find((quote) => quote.id === id) ?? null;
  }

  async listByServiceRequest(serviceRequestId: string): Promise<readonly Quote[]> {
    return quotes
      .filter((quote) => quote.serviceRequestId === serviceRequestId)
      .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
  }

  async listByTechnician(technicianId: string): Promise<readonly Quote[]> {
    return quotes
      .filter((quote) => quote.technicianId === technicianId)
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  }

  async create(input: CreateQuoteInput): Promise<Quote> {
    sequence += 1;
    const now = new Date().toISOString();
    const quote: Quote = {
      id: `quote-demo-${sequence}`,
      serviceRequestId: input.serviceRequestId,
      technicianId: input.technicianId,
      priceClp: input.priceClp,
      currency: "CLP",
      description: input.description,
      materialsIncluded: input.materialsIncluded,
      materialsNotIncluded: input.materialsNotIncluded,
      diagnosticVisit: input.diagnosticVisit,
      estimatedDuration: input.estimatedDuration,
      availableDate: input.availableDate,
      conditions: input.conditions,
      expiresAt: input.expiresAt,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    };
    quotes.unshift(quote);
    return quote;
  }

  async updateDraft(id: string, patch: UpdateQuoteDraftInput): Promise<Quote> {
    const quote = requireQuote(id);
    if (quote.status !== "draft") throw new Error("Sólo se puede editar una cotización en borrador.");
    return replaceQuote({ ...quote, ...patch, updatedAt: new Date().toISOString() });
  }

  async submit(id: string): Promise<Quote> {
    return applyTransition(requireQuote(id), "submitted");
  }

  async withdraw(id: string): Promise<Quote> {
    return applyTransition(requireQuote(id), "withdrawn");
  }

  async accept(id: string): Promise<Quote> {
    const quote = requireQuote(id);
    if (quote.status !== "submitted") throw new Error("Sólo se puede aceptar una cotización enviada.");

    // Sin `await` entre la lectura y la escritura: no hay punto de interleaving posible en Node,
    // por lo que esta operación es atómica en Mock Mode (impide adjudicar dos veces la misma solicitud).
    const accepted = applyTransition(quote, "accepted");
    quotes
      .filter((item) => item.serviceRequestId === quote.serviceRequestId && item.id !== quote.id && item.status === "submitted")
      .forEach((item) => applyTransition(item, "rejected"));
    return accepted;
  }
}
