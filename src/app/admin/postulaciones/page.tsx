import { applicationStateLabel } from "@/domain/technicians/application-labels";
import { z } from "zod";
import { AdminDashboardShell } from "@/components/admin/admin-dashboard-shell";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { TextLink } from "@/components/ui/text-link";
import { requireServerRole } from "@/services/auth/server-authentication-service";
import { getSupabaseServerClient } from "@/integrations/supabase/server-client";
import { loadProfessionalCategories } from "@/services/technicians/professional-application-service";
export default async function ProfessionalQueuePage({searchParams}:{searchParams:Promise<{state?:string;category?:string}>}){
 await requireServerRole(["moderator","superadmin"]);const filters=await searchParams,client=await getSupabaseServerClient();
 const result=await client.rpc("admin_professional_queue",{state_filter:filters.state||null,category_filter:filters.category||null});if(result.error)throw new Error("No pudimos cargar las postulaciones.");
 const rows=z.array(z.object({technician_id:z.uuid(),full_name:z.string(),state:z.string(),revision:z.number(),primary_category:z.string().nullable()})).parse(result.data);const categories=await loadProfessionalCategories();
 return <AdminDashboardShell activeHref="/admin/postulaciones"><h1 className="text-3xl font-bold">Postulaciones profesionales</h1><p className="mt-3 text-muted-foreground">Revisa los antecedentes y documentos antes de aprobar su publicación.</p><form className="my-6 flex flex-wrap items-end gap-3"><Field className="min-w-52" htmlFor="state" label="Estado"><Select defaultValue={filters.state??""} id="state" name="state"><option value="">Todos los estados</option>{["draft","submitted","needs_information","approved","rejected","suspended"].map(s=><option key={s} value={s}>{applicationStateLabel(s)}</option>)}</Select></Field><Field className="min-w-52" htmlFor="category" label="Rubro"><Select defaultValue={filters.category??""} id="category" name="category"><option value="">Todos los rubros</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field><Button type="submit" variant="outline">Filtrar postulaciones</Button></form><ul className="space-y-4">{rows.map(r=><li key={r.technician_id} className="rounded-lg border border-border bg-card p-5"><h2 className="text-xl">{r.full_name}</h2><p className="my-2 text-sm">{applicationStateLabel(r.state)} · {r.primary_category??"Rubro pendiente"} · revisión {r.revision}</p><TextLink className="underline" href={`/admin/postulaciones/${r.technician_id}`}>Abrir revisión profesional</TextLink></li>)}</ul>{!rows.length?<p className="rounded-xl bg-muted p-5">No hay postulaciones para estos filtros.</p>:null}</AdminDashboardShell>;
}
