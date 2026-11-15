import { z } from "zod";
import { AdminDashboardShell } from "@/components/admin/admin-dashboard-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { TextLink } from "@/components/ui/text-link";
import { administratorClient } from "@/services/admin/user-administration-service";
const schema=z.object({total:z.number(),page:z.number(),events:z.array(z.object({id:z.string(),actor_id:z.string().nullable(),target_id:z.string().nullable(),action:z.string(),reason:z.string(),result:z.string(),previous_value:z.unknown(),next_value:z.unknown(),created_at:z.string()}))});
export default async function AccountAuditPage({searchParams}:{searchParams:Promise<{page?:string;target?:string}>}) {
  const query=await searchParams;const page=Math.max(1,Math.min(10000,Math.floor(Number(query.page))||1));const target=z.uuid().safeParse(query.target).success?query.target:null;
  let data:z.infer<typeof schema>|null=null;
  try{const client=await administratorClient();const response=await client.rpc("admin_account_audit",{target_user:target,page_number:page});if(!response.error)data=schema.parse(response.data);}catch{/* controlled failure */}
  const pageHref=(value:number)=>"/admin/usuarios/auditoria?"+new URLSearchParams({...target?{target}:{},page:String(value)});
  return <AdminDashboardShell activeHref="/admin/usuarios/auditoria"><h1 className="text-3xl font-bold">Auditoría de cuentas</h1><p className="mt-3 text-sm text-muted-foreground">Eventos persistidos autorizados para tu rol. Los cambios exitosos se registran en la misma transacción.</p><form className="my-6 flex flex-wrap gap-3" role="search"><div className="min-w-0 flex-1"><Input aria-label="Filtrar por identificador de cuenta" defaultValue={target??""} name="target" placeholder="Identificador de cuenta (opcional)"/></div><Button type="submit" variant="outline">Filtrar</Button></form>{!data?<EmptyState title="Auditoría no disponible" description="No pudimos consultar los eventos."/>:<><div className="mt-4 space-y-3">{data.events.length?data.events.map(event=><article key={event.id} className="space-y-2 rounded-lg border border-border bg-card p-5"><h2 className="text-xl">{event.action} · {event.result}</h2><p className="text-sm">{event.reason}</p><p className="break-all text-xs text-muted-foreground">{event.created_at} · Actor: {event.actor_id??"Sistema"}</p>{event.target_id?<TextLink className="text-sm underline" href={"/admin/usuarios/"+event.target_id}>Ver cuenta objetivo</TextLink>:<p className="text-xs text-muted-foreground">Operación sin cuenta objetivo asociada.</p>}<pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">{JSON.stringify({antes:event.previous_value,despues:event.next_value},null,2)}</pre></article>):<p className="rounded-xl bg-muted p-4 text-sm">Sin eventos visibles.</p>}</div><Pagination hrefFor={pageHref} label="Paginación de auditoría" noun="eventos" page={data.page} pageSize={20} total={data.total} /></>}</AdminDashboardShell>;
}
