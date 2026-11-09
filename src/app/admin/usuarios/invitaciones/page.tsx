import { AdminDashboardShell } from "@/components/admin/admin-dashboard-shell";
import { InvitationsPanel } from "@/components/admin/invitations-panel";
import { EmptyState } from "@/components/shared/empty-state";
import { listInvitations } from "@/services/admin/user-administration-service";
import { requireServerRole } from "@/services/auth/server-authentication-service";
export default async function InvitationsPage(){
  const actor=await requireServerRole(["moderator","superadmin"]);let records:Awaited<ReturnType<typeof listInvitations>>|null=null;
  try{records=await listInvitations();}catch{/* distinguish no data from unavailable */}
  return <AdminDashboardShell activeHref="/admin/usuarios"><h1 className="mb-7 text-3xl font-bold">Invitaciones</h1>{records?<InvitationsPanel invitations={records} superadmin={actor?.role==="superadmin"} enabled={process.env.FIXO_INVITATIONS_ENABLED==="true"}/>:<EmptyState title="Invitaciones no disponibles" description="No pudimos consultar los registros. Verifica la configuración de este entorno."/>}</AdminDashboardShell>;
}
