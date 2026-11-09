import type { Job } from "@/domain/entities/job";
import type { AcceptedQuoteSnapshot } from "@/domain/entities/quote";
import type { JobStatus } from "@/domain/enums/job-status";
import { getSupabaseServerClient } from "@/integrations/supabase/server-client";
import type { CreateJobInput, JobRepository } from "@/repositories/contracts/job-repository";
import { asRecord, asRecords, asString, throwIfSupabaseError } from "./supabase-helpers";

export function mapJob(value: unknown): Job {
  const r = asRecord(value);
  return { id: asString(r.id), serviceRequestId: asString(r.service_request_id), quoteId: asString(r.quote_id), emergencyId: null,
    customerId: asString(r.customer_id), technicianId: asString(r.technician_id), status: "awarded", paymentState: "not_enabled",
    snapshot: asRecord(r.snapshot) as unknown as AcceptedQuoteSnapshot, createdAt: asString(r.created_at), updatedAt: asString(r.updated_at) };
}
export class SupabaseJobRepository implements JobRepository {
  async findByServiceRequest(requestId: string): Promise<Job | null> {
    const client = await getSupabaseServerClient();
    const { data, error } = await client.from("jobs").select("*").eq("service_request_id", requestId).maybeSingle();
    throwIfSupabaseError(error, "No pudimos cargar la adjudicación"); return data ? mapJob(data) : null;
  }
  async getById(id: string): Promise<Job | null> {
    const client = await getSupabaseServerClient();
    const { data, error } = await client.from("jobs").select("*").eq("id", id).maybeSingle();
    throwIfSupabaseError(error, "No pudimos cargar el trabajo"); return data ? mapJob(data) : null;
  }
  private async list(column: string, id: string): Promise<readonly Job[]> {
    const client = await getSupabaseServerClient();
    const { data, error } = await client.from("jobs").select("*").eq(column, id).order("created_at", { ascending: false }).limit(100);
    throwIfSupabaseError(error, "No pudimos cargar los trabajos"); return asRecords(data).map(mapJob);
  }
  listForCustomer(id: string) { return this.list("customer_id", id); }
  listForTechnician(id: string) { return this.list("technician_id", id); }
  async findByEmergencyId(_id: string): Promise<Job | null> { return null; }
  async create(_input: CreateJobInput): Promise<Job> { throw new Error("El trabajo se crea al adjudicar una cotización de forma atómica."); }
  async updateStatus(_id: string, _next: JobStatus): Promise<Job> { throw new Error("La ejecución y los pagos todavía no están habilitados."); }
}
