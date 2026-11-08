import type { ServiceRequest } from "@/domain/entities/service-request";
import type { ServiceRequestStatus } from "@/domain/enums/service-request-status";
import { getSupabaseServerClient } from "@/integrations/supabase/server-client";
import type { CreateServiceRequestInput, ServiceRequestRepository } from "@/repositories/contracts/service-request-repository";
import { asRecord, asRecords, asString, throwIfSupabaseError } from "@/repositories/supabase/supabase-helpers";

function mapRequest(value: unknown): ServiceRequest {
  const row = asRecord(value);
  return {
    id: asString(row.id),
    customerId: asString(row.customer_id),
    title: asString(row.title),
    categoryId: asString(row.category_id),
    description: asString(row.description),
    priority: asString(row.priority, "standard") === "urgent" ? "urgent" : "standard",
    status: asString(row.status, "submitted") as ServiceRequestStatus,
    locationLabel: asString(row.location_label),
    createdAt: asString(row.created_at),
    scheduledFor: typeof row.scheduled_for === "string" ? row.scheduled_for : null,
  };
}

export class SupabaseServiceRequestRepository implements ServiceRequestRepository {
  async listForCustomer(customerId: string): Promise<readonly ServiceRequest[]> {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase.from("service_requests").select("id, customer_id, title, category_id, description, priority, status, location_label, created_at, scheduled_for").eq("customer_id", customerId).order("created_at", { ascending: false });
    throwIfSupabaseError(error, "No pudimos cargar tus solicitudes");
    return asRecords(data).map(mapRequest);
  }

  async findById(id: string): Promise<ServiceRequest | null> {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase.from("service_requests").select("id, customer_id, title, category_id, description, priority, status, location_label, created_at, scheduled_for").eq("id", id).maybeSingle();
    throwIfSupabaseError(error, "No pudimos cargar la solicitud");
    return data ? mapRequest(data) : null;
  }

  async create(input: CreateServiceRequestInput): Promise<ServiceRequest> {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("service_requests")
      .insert({
        customer_id: input.customerId,
        category_id: input.categoryId,
        title: input.title,
        description: input.description,
        location_label: input.locationLabel,
        priority: input.priority,
        status: "submitted",
        scheduled_for: input.scheduledFor,
      })
      .select("id, customer_id, title, category_id, description, priority, status, location_label, created_at, scheduled_for")
      .single();
    throwIfSupabaseError(error, "No pudimos registrar tu solicitud");
    return mapRequest(data);
  }

  async updateStatus(id: string, next: ServiceRequestStatus): Promise<ServiceRequest> {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("service_requests")
      .update({ status: next })
      .eq("id", id)
      .select("id, customer_id, title, category_id, description, priority, status, location_label, created_at, scheduled_for")
      .single();
    throwIfSupabaseError(error, "No pudimos actualizar el estado de la solicitud");
    return mapRequest(data);
  }

  async listOpenForCategory(categoryId: string): Promise<readonly ServiceRequest[]> {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("service_requests")
      .select("id, customer_id, title, category_id, description, priority, status, location_label, created_at, scheduled_for")
      .eq("category_id", categoryId)
      .in("status", ["matching", "receiving_quotes"])
      .order("created_at", { ascending: false });
    throwIfSupabaseError(error, "No pudimos cargar las solicitudes abiertas");
    return asRecords(data).map(mapRequest);
  }
}
