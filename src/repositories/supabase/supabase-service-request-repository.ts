import type { ServiceRequest } from "@/domain/entities/service-request";
import type { ServiceRequestStatus } from "@/domain/enums/service-request-status";
import { getSupabaseServerClient } from "@/integrations/supabase/server-client";
import type { CreateServiceRequestInput, ServiceRequestRepository } from "@/repositories/contracts/service-request-repository";
import { asRecord, asRecords, asString, asNumber, throwIfSupabaseError } from "./supabase-helpers";

export function mapRequest(value: unknown): ServiceRequest {
  const row = asRecord(value);
  return {
    id: asString(row.id), customerId: asString(row.customer_id), title: asString(row.title), categoryId: asString(row.category_id),
    description: asString(row.description), priority: row.priority === "urgent" ? "urgent" : "standard",
    status: asString(row.status, "submitted") as ServiceRequestStatus, locationLabel: asString(row.location_label),
    createdAt: asString(row.created_at), scheduledFor: typeof row.scheduled_for === "string" ? row.scheduled_for : null,
    revision: asNumber(row.revision, 1), quoteCount: asNumber(row.quote_count),
    details: asRecord(row.details), history: asRecords(row.history).map(e => ({ id: asString(e.id), action: asString(e.action), next_state: asString(e.next_state), created_at: asString(e.created_at) })),
  };
}
export class SupabaseServiceRequestRepository implements ServiceRequestRepository {
  async listPageForCustomer(page: number) {
    const client = await getSupabaseServerClient();
    const { data, error } = await client.rpc("marketplace_customer_requests", { page_number: page });
    throwIfSupabaseError(error, "No pudimos cargar tus solicitudes");
    const result = asRecord(data);
    return { items: asRecords(result.items).map(mapRequest), total: asNumber(result.total) };
  }
  async listForCustomer(_customerId: string): Promise<readonly ServiceRequest[]> { return (await this.listPageForCustomer(1)).items; }
  async findById(id: string): Promise<ServiceRequest | null> {
    const client = await getSupabaseServerClient();
    const { data, error } = await client.rpc("marketplace_request_detail", { request_id: id });
    throwIfSupabaseError(error, "No pudimos cargar la solicitud"); return data ? mapRequest(data) : null;
  }
  async create(input: CreateServiceRequestInput): Promise<ServiceRequest> {
    const client = await getSupabaseServerClient();
    if (input.priority !== "standard") throw new Error("Solo se admiten solicitudes normales.");
    const { data, error } = await client.rpc("marketplace_create_request", { operation_id: input.operationId, payload: {
      title: input.title, categoryId: input.categoryId, description: input.description, locationLabel: input.locationLabel,
      scheduledFor: input.scheduledFor, address: input.address ?? "", reference: input.reference ?? "",
      preferredSlot: input.preferredSlot ?? "", complementaryInfo: input.complementaryInfo ?? "",
    } });
    throwIfSupabaseError(error, "No pudimos registrar tu solicitud"); return mapRequest(data);
  }
  async cancel(id: string, revision: number): Promise<ServiceRequest> {
    const client = await getSupabaseServerClient();
    const { data, error } = await client.rpc("marketplace_cancel_request", { request_id: id, expected_revision: revision });
    throwIfSupabaseError(error, "No pudimos cancelar la solicitud"); return mapRequest(data);
  }
  async updateStatus(_id: string, _next: ServiceRequestStatus): Promise<ServiceRequest> { throw new Error("Utiliza la transición autorizada de la solicitud."); }
  async listOpenForCategory(categoryId: string): Promise<readonly ServiceRequest[]> {
    const client = await getSupabaseServerClient();
    const { data, error } = await client.rpc("marketplace_opportunities", { category: categoryId });
    throwIfSupabaseError(error, "No pudimos cargar las oportunidades");
    // Deliberately redacted customer ID: only the SQL projection authorizes discovery.
    return asRecords(data).map(mapRequest);
  }
}
