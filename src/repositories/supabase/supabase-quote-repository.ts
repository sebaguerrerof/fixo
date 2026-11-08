import type { Quote } from "@/domain/entities/quote";
import type { CreateQuoteInput, QuoteRepository, UpdateQuoteDraftInput } from "@/repositories/contracts/quote-repository";

const NOT_IMPLEMENTED = "Esta función todavía no está disponible en Fixo.";

/**
 * Deja preparada la arquitectura (contrato + factory) sin acoplar la UI a
 * Supabase. La implementación real (tablas `quotes`/RLS/RPC de aceptación
 * atómica) queda como siguiente milestone explícito.
 */
export class SupabaseQuoteRepository implements QuoteRepository {
  async getById(_id: string): Promise<Quote | null> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async listByServiceRequest(_serviceRequestId: string): Promise<readonly Quote[]> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async listByTechnician(_technicianId: string): Promise<readonly Quote[]> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async create(_input: CreateQuoteInput): Promise<Quote> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async updateDraft(_id: string, _patch: UpdateQuoteDraftInput): Promise<Quote> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async submit(_id: string): Promise<Quote> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async withdraw(_id: string): Promise<Quote> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async accept(_id: string): Promise<Quote> {
    throw new Error(NOT_IMPLEMENTED);
  }
}
