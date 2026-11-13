import { notFound } from "next/navigation";
import { AdminDashboardShell } from "@/components/admin/admin-dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSupabaseServerClient } from "@/integrations/supabase/server-client";
import { requireServerRole } from "@/services/auth/server-authentication-service";
import { asRecord, asRecords, asString, asNumber, throwIfSupabaseError } from "@/repositories/supabase/supabase-helpers";
import { formatClp } from "@/lib/utils";
export default async function AdminRequestDetail({ params }: { readonly params: Promise<{ id: string }> }) {
  await requireServerRole(["moderator", "superadmin"]); const { id } = await params;
  const result = await (await getSupabaseServerClient()).rpc("marketplace_admin_detail", { request_id: id });
  throwIfSupabaseError(result.error, "No pudimos cargar el detalle"); const data = asRecord(result.data), row = asRecord(data.request);
  if (!row.id) notFound(); const details = asRecord(row.details), job = asRecord(data.job);
  return <AdminDashboardShell activeHref="/admin/solicitudes"><h1 className="text-3xl font-bold">{asString(row.title)}</h1><p className="mt-3">{asString(row.description)}</p>
    <Card className="mt-6"><CardHeader><CardTitle>Solicitud</CardTitle></CardHeader><CardContent className="space-y-2 break-words"><p>{asString(row.category_id)} · {asString(row.location_label)} · {asString(row.status)}</p><p>Cliente: {asString(row.customer_id)}</p><p>Dirección privada: {asString(details.address)}</p><p>{asString(details.reference)}</p><p>{asString(details.preferred_slot)}</p></CardContent></Card>
    <Card className="mt-6"><CardHeader><CardTitle>Técnicos elegibles ahora</CardTitle></CardHeader><CardContent>{asRecords(data.eligible).map(t => <p key={asString(t.id)}>{asString(t.name)}</p>)}{!asRecords(data.eligible).length ? <p>Sin técnicos habilitados para nuevas propuestas.</p> : null}</CardContent></Card>
    <Card className="mt-6"><CardHeader><CardTitle>Cotizaciones</CardTitle></CardHeader><CardContent>{asRecords(data.quotes).map(q => <div className="border-t py-3" key={asString(q.id)}><p>{formatClp(asNumber(q.price_clp))} · {asString(q.status)} · versión {asNumber(q.revision)}</p><p>{asString(q.description)}</p><p>{asString(q.conditions)}</p></div>)}</CardContent></Card>
    <Card className="mt-6"><CardHeader><CardTitle>Adjudicación</CardTitle></CardHeader><CardContent>{job.id ? <><p>Trabajo {asString(job.id)}</p><p>Adjudicado · pago no habilitado · ejecución pendiente</p><p>{formatClp(asNumber(asRecord(job.snapshot).priceClp))}</p></> : <p>Sin adjudicación</p>}</CardContent></Card>
    <section className="mt-6"><h2 className="text-xl font-bold">Historial de transiciones</h2><ol className="mt-3 space-y-2">{asRecords(data.history).map(e => <li className="break-words rounded-xl border p-3 text-sm" key={asString(e.id)}>{asString(e.action)} · {asString(e.previous_state)} → {asString(e.next_state)}<p>Actor: {asString(e.actor_id)} · {asString(e.created_at)}</p></li>)}</ol></section>
  </AdminDashboardShell>;
}
