import type { Quote } from "@/domain/entities/quote";

export interface CreateQuoteInput {
  readonly serviceRequestId: string;
  readonly technicianId: string;
  readonly priceClp: number;
  readonly description: string;
  readonly materialsIncluded: string;
  readonly materialsNotIncluded: string;
  readonly diagnosticVisit: boolean;
  readonly estimatedDuration: string;
  readonly availableDate: string;
  readonly conditions: string;
  readonly expiresAt: string;
}

export interface UpdateQuoteDraftInput {
  readonly priceClp?: number;
  readonly description?: string;
  readonly materialsIncluded?: string;
  readonly materialsNotIncluded?: string;
  readonly diagnosticVisit?: boolean;
  readonly estimatedDuration?: string;
  readonly availableDate?: string;
  readonly conditions?: string;
  readonly expiresAt?: string;
}

export interface QuoteRepository {
  getById(id: string): Promise<Quote | null>;
  listByServiceRequest(serviceRequestId: string): Promise<readonly Quote[]>;
  listByTechnician(technicianId: string): Promise<readonly Quote[]>;
  /** Crea la cotización como `draft`. */
  create(input: CreateQuoteInput): Promise<Quote>;
  updateDraft(id: string, patch: UpdateQuoteDraftInput): Promise<Quote>;
  submit(id: string): Promise<Quote>;
  withdraw(id: string): Promise<Quote>;
  /**
   * Marca la cotización como `accepted` y rechaza las demás cotizaciones
   * `submitted` de la misma solicitud, como una única operación lógica.
   * En Supabase deberá implementarse mediante una función/RPC transaccional.
   */
  accept(id: string): Promise<Quote>;
}
