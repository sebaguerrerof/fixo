import type { Job } from "@/domain/entities/job";
import type { AcceptedQuoteSnapshot } from "@/domain/entities/quote";
import { DEMO_CUSTOMER_ID } from "@/repositories/mock/fixtures/demo-accounts";
import { DEMO_QUOTES } from "@/repositories/mock/fixtures/quotes";

const hoursAgo = (hours: number): string => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

function snapshotFromQuote(quoteId: string, acceptedAt: string): AcceptedQuoteSnapshot {
  const quote = DEMO_QUOTES.find((item) => item.id === quoteId);
  if (!quote) throw new Error(`Fixture inconsistente: no existe la cotización ${quoteId}`);
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

/** Trabajos demo originados por cotizaciones ya aceptadas en `fixtures/quotes.ts`. */
export const DEMO_JOBS: readonly Job[] = [
  {
    id: "job-01",
    serviceRequestId: "req-01",
    quoteId: "quote-01",
    emergencyId: null,
    customerId: DEMO_CUSTOMER_ID,
    technicianId: "tech-02",
    status: "in_progress",
    snapshot: snapshotFromQuote("quote-01", hoursAgo(28)),
    createdAt: hoursAgo(28),
    updatedAt: hoursAgo(2),
  },
  {
    id: "job-02",
    serviceRequestId: "req-03",
    quoteId: "quote-06",
    emergencyId: null,
    customerId: DEMO_CUSTOMER_ID,
    technicianId: "tech-04",
    status: "scheduled",
    snapshot: snapshotFromQuote("quote-06", hoursAgo(45)),
    createdAt: hoursAgo(45),
    updatedAt: hoursAgo(45),
  },
  {
    id: "job-03",
    serviceRequestId: "req-07",
    quoteId: "quote-07",
    emergencyId: null,
    customerId: DEMO_CUSTOMER_ID,
    technicianId: "tech-07",
    status: "scheduled",
    snapshot: snapshotFromQuote("quote-07", hoursAgo(14)),
    createdAt: hoursAgo(14),
    updatedAt: hoursAgo(14),
  },
  {
    id: "job-04",
    serviceRequestId: "req-05",
    quoteId: "quote-08",
    emergencyId: null,
    customerId: DEMO_CUSTOMER_ID,
    technicianId: "tech-08",
    status: "completed",
    snapshot: snapshotFromQuote("quote-08", hoursAgo(390)),
    createdAt: hoursAgo(390),
    updatedAt: hoursAgo(370),
  },
];
