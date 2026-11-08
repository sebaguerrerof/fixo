"use client";

import type { AdminAuditEntry } from "@/domain/entities/audit-log";
import type { Technician } from "@/domain/entities/technician";
import type { TechnicianStatus } from "@/domain/enums/technician-status";
import { getSupabaseBrowserClient } from "@/integrations/supabase/browser-client";
import { asRecords, asString, throwIfSupabaseError } from "@/repositories/supabase/supabase-helpers";

export class SupabaseAdminManagementStore {
  async changeTechnicianStatus(technician: Technician, nextStatus: TechnicianStatus, reason: string): Promise<Technician> {
    const { error } = await getSupabaseBrowserClient().rpc("change_technician_status", {
      target_technician_id: technician.id,
      next_status: nextStatus,
      change_reason: reason,
    });
    throwIfSupabaseError(error, "No pudimos actualizar el estado del técnico");
    return { ...technician, status: nextStatus };
  }

  async readAuditEntries(technicianId?: string): Promise<AdminAuditEntry[]> {
    let query = getSupabaseBrowserClient().from("admin_audit_entries").select("id, actor_id, technician_id, action, previous_status, next_status, reason, created_at").order("created_at", { ascending: false });
    if (technicianId) query = query.eq("technician_id", technicianId);
    const { data, error } = await query;
    throwIfSupabaseError(error, "No pudimos cargar el historial administrativo");

    const rows = asRecords(data);
    const profileIds = [...new Set(rows.flatMap((row) => [asString(row.actor_id), asString(row.technician_id)]).filter(Boolean))];
    const { data: profiles, error: profileError } = profileIds.length ? await getSupabaseBrowserClient().from("profiles").select("id, full_name").in("id", profileIds) : { data: [], error: null };
    throwIfSupabaseError(profileError, "No pudimos cargar los responsables del historial");
    const names = new Map(asRecords(profiles).map((profile) => [asString(profile.id), asString(profile.full_name, "Administración")]));

    return rows.map((row) => ({
      id: asString(row.id),
      actorName: names.get(asString(row.actor_id)) ?? "Administración",
      technicianId: asString(row.technician_id),
      technicianName: names.get(asString(row.technician_id)) ?? "Técnico",
      action: "technician_status_changed",
      previousStatus: asString(row.previous_status) as TechnicianStatus,
      nextStatus: asString(row.next_status) as TechnicianStatus,
      reason: asString(row.reason),
      createdAt: asString(row.created_at),
    }));
  }
}
