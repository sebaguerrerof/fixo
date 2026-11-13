import type { QuoteStatus } from "@/domain/enums/quote-status";

export interface Quote {
  readonly revision?: number;
  readonly laborClp?: number;
  readonly materialsClp?: number;
  readonly diagnosticClp?: number;
  readonly id: string;
  readonly serviceRequestId: string;
  readonly technicianId: string;
  readonly priceClp: number;
  readonly currency: "CLP";
  readonly description: string;
  readonly materialsIncluded: string;
  readonly materialsNotIncluded: string;
  readonly diagnosticVisit: boolean;
  readonly estimatedDuration: string;
  readonly availableDate: string;
  readonly conditions: string;
  readonly expiresAt: string;
  readonly status: QuoteStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Términos congelados al momento de aceptar una cotización: evita que
 * cambios posteriores al técnico, la solicitud o la cotización alteren
 * retroactivamente lo contratado.
 */
export interface AcceptedQuoteSnapshot {
  readonly quoteId: string;
  readonly serviceRequestId: string;
  readonly technicianId: string;
  readonly priceClp: number;
  readonly currency: "CLP";
  readonly description: string;
  readonly materialsIncluded: string;
  readonly materialsNotIncluded: string;
  readonly diagnosticVisit: boolean;
  readonly estimatedDuration: string;
  readonly availableDate: string;
  readonly conditions: string;
  readonly acceptedAt: string;
}
