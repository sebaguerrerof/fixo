import Link from "next/link";
import { AdminDashboardShell } from "@/components/admin/admin-dashboard-shell";
import { getSupabaseServerClient } from "@/integrations/supabase/server-client";
import { requireServerRole } from "@/services/auth/server-authentication-service";
import { asRecords, asString, asNumber, throwIfSupabaseError } from "@/repositories/supabase/supabase-helpers";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
export default async function AdminRequests({ searchParams }: { readonly searchParams: Promise<{ page?: string; state?: string }> }) {
  await requireServerRole(["moderator", "superadmin"]);
  const query = await searchParams, page = Math.min(10000, Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1));
  const client = await getSupabaseServerClient();
  const result = await client.rpc("marketplace_admin_requests", { page_number: page, state_filter: query.state || null });
  throwIfSupabaseError(result.error, "No pudimos cargar las solicitudes"); const rows = asRecords(result.data);
  return <AdminDashboardShell activeHref="/admin/solicitudes"><h1 className="text-3xl font-bold">Solicitudes y adjudicaciones</h1>
    <form className="my-6 flex flex-wrap items-end gap-3"><Field className="min-w-52" htmlFor="state" label="Estado"><Select defaultValue={query.state ?? ""} id="state" name="state"><option value="">Todos</option><option value="submitted">Publicadas</option><option value="receiving_quotes">Recibiendo propuestas</option><option value="technician_selected">Adjudicadas</option><option value="cancelled">Canceladas</option></Select></Field><Button type="submit" variant="outline">Filtrar</Button></form>
    <Card><CardContent className="overflow-x-auto p-5"><table className="w-full min-w-[660px] text-left text-sm"><thead><tr><th className="p-2">Solicitud / cliente</th><th>Rubro / comuna</th><th>Estado</th><th>Cotizaciones</th><th>Elegibles</th><th>Trabajo</th></tr></thead><tbody>{rows.map(r => <tr className="border-t" key={asString(r.id)}><td className="p-2"><Link className="font-semibold text-primary underline" href={`/admin/solicitudes/${asString(r.id)}`}>{asString(r.title)}</Link><p>{asString(r.customer_name)}</p></td><td>{asString(r.category_id)}<br />{asString(r.location_label)}</td><td>{asString(r.status)}</td><td>{asNumber(r.quote_count)}</td><td>{asNumber(r.eligible_count)}</td><td>{r.job_id ? "Adjudicado" : "Sin adjudicación"}</td></tr>)}</tbody></table>{!rows.length ? <p className="py-4">No hay solicitudes con estos filtros.</p> : null}</CardContent></Card>
    <nav aria-label="Páginas de solicitudes" className="mt-6 flex flex-wrap items-center gap-3">{page > 1 ? <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/admin/solicitudes?page=${page - 1}&state=${encodeURIComponent(query.state ?? "")}`}>Anterior</Link> : null}<span className="tabular text-sm text-muted-foreground">Página {page}</span>{rows.length === 20 ? <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/admin/solicitudes?page=${page + 1}&state=${encodeURIComponent(query.state ?? "")}`}>Siguiente</Link> : null}</nav>
  </AdminDashboardShell>;
}
