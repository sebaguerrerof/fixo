import { notFound } from "next/navigation";
import { z } from "zod";
import { AdminDashboardShell } from "@/components/admin/admin-dashboard-shell";
import { AccountControls } from "@/components/admin/account-controls";
import { EmptyState } from "@/components/shared/empty-state";
import { userDetail } from "@/services/admin/user-administration-service";
import { requireServerRole } from "@/services/auth/server-authentication-service";
export default async function UserPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;if(!z.uuid().safeParse(id).success)notFound();
  const actor=await requireServerRole(["moderator","superadmin"]);let user:Awaited<ReturnType<typeof userDetail>>=null;let failed=false;
  try{user=await userDetail(id);}catch{failed=true;}
  if(!user&&!failed)notFound();
  return <AdminDashboardShell activeHref="/admin/usuarios">{!user?<EmptyState title="Cuenta no disponible" description="No pudimos cargar su información."/>:<><h1 className="text-3xl font-bold">{user.full_name}</h1><dl className="mt-7 grid gap-5 rounded-2xl border bg-background p-5 sm:grid-cols-2">{[["Correo",user.email],["Teléfono",user.phone||"Sin informar"],["Rol",user.role],["Cuenta",user.account_status],["Registro",user.created_at],["Último acceso Auth",user.last_sign_in_at??"Sin actividad registrada"],["Postulación profesional",user.technician_status??"No corresponde"]].map(([label,value])=><div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>)}</dl><AccountControls id={user.id} role={user.role} isSelf={actor?.id===user.id} superadmin={actor?.role==="superadmin"}/><section className="mt-7"><h2 className="text-xl font-bold">Historial administrativo</h2><p className="mt-2 text-sm text-muted-foreground">Hasta 100 eventos recientes autorizados para tu rol.</p><div className="mt-4 space-y-3">{user.history.length?user.history.map(event=><article key={event.id} className="rounded-xl border bg-background p-4"><p className="font-semibold">{event.action} · {event.result}</p><p className="mt-2 text-sm">{event.reason}</p><p className="mt-2 break-all text-xs text-muted-foreground">{event.created_at} · Actor: {event.actor_id??"Sistema"}</p></article>):<p className="rounded-xl bg-muted p-4 text-sm">Sin eventos visibles para tu rol.</p>}</div></section></>}</AdminDashboardShell>;
}
