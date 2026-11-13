import type { Quote } from "@/domain/entities/quote";
import type { QuoteStatus } from "@/domain/enums/quote-status";
import type { CreateQuoteInput, QuoteRepository, UpdateQuoteDraftInput } from "@/repositories/contracts/quote-repository";
import { getSupabaseServerClient } from "@/integrations/supabase/server-client";
import { asRecord, asRecords, asString, asNumber, throwIfSupabaseError } from "./supabase-helpers";
import { mapRequest } from "./supabase-service-request-repository";
import { mapJob } from "./supabase-job-repository";

export function mapQuote(value: unknown): Quote {
  const r = asRecord(value);
  return { id: asString(r.id), serviceRequestId: asString(r.service_request_id), technicianId: asString(r.technician_id),
    priceClp: asNumber(r.price_clp), laborClp: asNumber(r.labor_clp), materialsClp: asNumber(r.materials_clp), diagnosticClp: asNumber(r.diagnostic_clp),
    currency: "CLP", description: asString(r.description), materialsIncluded: asString(r.materials_included), materialsNotIncluded: asString(r.materials_not_included),
    diagnosticVisit: r.diagnostic_visit === true, estimatedDuration: asString(r.estimated_duration), availableDate: asString(r.available_date), conditions: asString(r.conditions),
    expiresAt: asString(r.expires_at), status: asString(r.status) as QuoteStatus, revision: asNumber(r.revision, 1), createdAt: asString(r.created_at), updatedAt: asString(r.updated_at) };
}
export class SupabaseQuoteRepository implements QuoteRepository {
  async getById(id: string): Promise<Quote | null> {
    const client = await getSupabaseServerClient();
    const { data, error } = await client.from("quotes").select("*").eq("id", id).maybeSingle();
    throwIfSupabaseError(error, "No pudimos cargar la cotización"); return data ? mapQuote(data) : null;
  }
  private async list(column: string, id: string): Promise<readonly Quote[]> {
    const client = await getSupabaseServerClient();
    const { data, error } = await client.from("quotes").select("*").eq(column, id).order("created_at", { ascending: false }).limit(100);
    throwIfSupabaseError(error, "No pudimos cargar las cotizaciones"); return asRecords(data).map(mapQuote);
  }
  listByServiceRequest(id: string) { return this.list("service_request_id", id); }
  listByTechnician(id: string) { return this.list("technician_id", id); }
  async create(input: CreateQuoteInput): Promise<Quote> {
    const client = await getSupabaseServerClient();
    const { data, error } = await client.rpc("marketplace_save_quote", { request_id: input.serviceRequestId, operation_id: input.operationId,
      expected_revision: input.expectedRevision ?? 0, payload: { laborClp: input.laborClp ?? input.priceClp, materialsClp: input.materialsClp ?? 0,
        diagnosticClp: input.diagnosticClp ?? 0, description: input.description, materialsIncluded: input.materialsIncluded, materialsNotIncluded: input.materialsNotIncluded,
        diagnosticVisit: input.diagnosticVisit, estimatedDuration: input.estimatedDuration, availableDate: input.availableDate, conditions: input.conditions, expiresAt: input.expiresAt } });
    throwIfSupabaseError(error, "No pudimos guardar la cotización"); return mapQuote(data);
  }
  async updateDraft(id: string, patch: UpdateQuoteDraftInput): Promise<Quote> {
    if (!patch.operationId || !Number.isSafeInteger(patch.expectedRevision) || (patch.expectedRevision ?? 0) < 1) throw new Error("Indica la operación y la versión del borrador.");
    const current = await this.getById(id); if (!current) throw new Error("Cotización no disponible.");
    const materialsClp = patch.materialsClp ?? current.materialsClp ?? 0;
    const diagnosticClp = patch.diagnosticClp ?? current.diagnosticClp ?? 0;
    const laborClp = patch.laborClp ?? (patch.priceClp !== undefined ? patch.priceClp - materialsClp - diagnosticClp : current.laborClp ?? current.priceClp);
    return this.create({ ...current, ...patch, materialsClp, diagnosticClp, laborClp, priceClp: laborClp + materialsClp + diagnosticClp });
  }
  private async transition(id: string, status: string): Promise<Quote> {
    const current = await this.getById(id); if (!current) throw new Error("Cotización no disponible.");
    const client = await getSupabaseServerClient();
    const { data, error } = await client.rpc("marketplace_transition_quote", { quote_id: id, next_status: status, expected_revision: current.revision });
    throwIfSupabaseError(error, "No pudimos actualizar la cotización"); return mapQuote(data);
  }
  submit(id: string) { return this.transition(id, "submitted"); }
  withdraw(id: string) { return this.transition(id, "withdrawn"); }
  async acceptAtomically(requestId: string, id: string, revision: number) {
    const client = await getSupabaseServerClient();
    const { data, error } = await client.rpc("marketplace_accept_quote", { request_id: requestId, quote_id: id, expected_revision: revision });
    throwIfSupabaseError(error, "No pudimos adjudicar la propuesta"); const r = asRecord(data);
    return { request: mapRequest(r.request), quote: mapQuote(r.quote), job: mapJob(r.job) };
  }
  async accept(id: string): Promise<Quote> {
    const q = await this.getById(id); if (!q) throw new Error("Cotización no disponible.");
    return (await this.acceptAtomically(q.serviceRequestId, id, q.revision ?? 1)).quote;
  }
}
