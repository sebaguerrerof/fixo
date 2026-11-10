import type { Job } from "@/domain/entities/job";
import type { AcceptedQuoteSnapshot } from "@/domain/entities/quote";
import type { JobStatus } from "@/domain/enums/job-status";
import { getSupabaseServerClient } from "@/integrations/supabase/server-client";
import type { CreateJobInput, JobRepository } from "@/repositories/contracts/job-repository";
import { asRecord, asRecords, asString, asNumber, throwIfSupabaseError } from "./supabase-helpers";
import type { ExecutionMode, JobDetail, JobPage, JobCommandReceipt } from "@/domain/entities/job-operations";
import { jobRpcPayload, type JobCommandInput } from "@/domain/validation/job-command";

export function mapJob(value: unknown): Job {
  const r = asRecord(value);
  return { id: asString(r.id), serviceRequestId: asString(r.service_request_id), quoteId: asString(r.quote_id), emergencyId: null,
    customerId: asString(r.customer_id), technicianId: asString(r.technician_id), status: asString(r.status, "awarded") as JobStatus, paymentState: "not_enabled",
    revision: asNumber(r.revision, 1), confirmedScheduleId: typeof r.confirmed_schedule_id === "string" ? r.confirmed_schedule_id : null,
    startedAt: typeof r.started_at === "string" ? r.started_at : null, completionReportedAt: typeof r.completion_reported_at === "string" ? r.completion_reported_at : null, customerConfirmedAt: typeof r.customer_confirmed_at === "string" ? r.customer_confirmed_at : null,
    snapshot: asRecord(r.snapshot) as unknown as AcceptedQuoteSnapshot, createdAt: asString(r.created_at), updatedAt: asString(r.updated_at) };
}
export class SupabaseJobRepository implements JobRepository {
  async listPage(page: number, state?: string): Promise<JobPage> {
    const client = await getSupabaseServerClient(); const { data, error } = await client.rpc("job_list", { page_number: page, state_filter: state || null });
    throwIfSupabaseError(error, "No pudimos cargar los trabajos"); const r = asRecord(data);
    return { total: asNumber(r.total), items: asRecords(r.items).map(x => ({ job: mapJob(x), title: asString(x.title), commune: asString(x.location_label), customerName: asString(x.customer_name), technicianName: asString(x.technician_name), activeIncident: x.active_incident === true, cancellationPending: x.cancellation_pending === true, executionEnabled: x.execution_enabled === true })) };
  }
  async getDetail(id: string): Promise<JobDetail | null> {
    const client = await getSupabaseServerClient(); const { data, error } = await client.rpc("job_detail", { job_id: id });
    throwIfSupabaseError(error, "No pudimos cargar el trabajo"); return data ? mapJobDetail(data) : null;
  }
  async command(input: JobCommandInput): Promise<JobCommandReceipt> {
    const client = await getSupabaseServerClient(); const { data, error } = await client.rpc("job_command", { job_id: input.jobId, operation_id: input.operationId, expected_revision: input.expectedRevision, action: input.command.action, payload: jobRpcPayload(input.command) });
    if (error) throw new Error(error.code === "PT409" ? "El trabajo cambió. Actualiza antes de volver a intentarlo." : error.code === "42501" ? "Esta operación no está habilitada para tu cuenta o para este trabajo." : "No pudimos confirmar la operación. Revisa el historial antes de repetirla.");
    const r = asRecord(data); return { jobId: asString(r.job_id), revision: asNumber(r.revision), status: asString(r.status), resourceId: typeof r.resource_id === "string" ? r.resource_id : null };
  }
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

function mapJobDetail(value: unknown): JobDetail {
  const r = asRecord(value);
  return { job: mapJob(r.job), title: asString(r.title), commune: asString(r.commune), customerName: asString(r.customer_name), technicianName: asString(r.technician_name), address: typeof r.address === "string" ? r.address : null, reference: typeof r.reference === "string" ? r.reference : null, canOperate: r.can_operate === true, canViewPrivate: r.can_view_private === true, isAdministrator: r.is_administrator === true, executionMode: asString(r.execution_mode, "disabled") as ExecutionMode, executionEnabled: r.execution_enabled === true,
    schedules: asRecords(r.schedules).map(s => ({ id: asString(s.id), actorId: asString(s.actor_id), startsAt: asString(s.starts_at), endsAt: asString(s.ends_at), state: asString(s.state) as JobDetail["schedules"][number]["state"], reason: asString(s.reason), version: asNumber(s.version) })),
    cancellations: asRecords(r.cancellations).map(c => ({ id: asString(c.id), actorId: asString(c.actor_id), reason: asString(c.reason), state: asString(c.state) as JobDetail["cancellations"][number]["state"], resolution: asString(c.resolution) })),
    incidents: asRecords(r.incidents).map(i => ({ id: asString(i.id), openedBy: asString(i.opened_by), kind: asString(i.kind), description: asString(i.description), state: asString(i.state) as JobDetail["incidents"][number]["state"], resolution: asString(i.resolution), messages: asRecords(i.messages).map(m => ({ id: asString(m.id), actorId: asString(m.actor_id), body: asString(m.body), kind: asString(m.kind), createdAt: asString(m.created_at) })), attachments: asRecords(i.attachments).map(a => ({ id: asString(a.id), actorId: asString(a.actor_id) })) })),
    history: asRecords(r.history).map(e => ({ id: asString(e.id), actorId: asString(e.actor_id), action: asString(e.action), previousState: asString(e.previous_state), nextState: asString(e.next_state), createdAt: asString(e.created_at), note: asString(asRecord(e.details).note) })),
    notifications: asRecords(r.notifications).map(o => ({ id: asString(o.id), event: asString(o.event), state: asString(o.state), createdAt: asString(o.created_at) })),
  };
}
