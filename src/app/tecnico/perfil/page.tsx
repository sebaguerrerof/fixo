import Link from "next/link";
import { TechnicianDashboardShell } from "@/components/technicians/technician-dashboard-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { getServerAuthenticatedUser } from "@/services/auth/server-authentication-service";
import { TechnicianDashboardService } from "@/services/technicians/technician-dashboard-service";

export default async function TechnicianProfilePage() {
  const user = await getServerAuthenticatedUser();
  if (!user) return null;
  const overview = await new TechnicianDashboardService().getOverview(user.id);
  if (!overview) return <TechnicianDashboardShell activeHref="/tecnico/perfil"><EmptyState title="Perfil técnico no disponible" description="No encontramos una postulación asociada a tu cuenta." /></TechnicianDashboardShell>;
  const { technician } = overview;
  const published = ["verified", "active"].includes(technician.status);
  return <TechnicianDashboardShell activeHref="/tecnico/perfil"><h1 className="mb-7 text-3xl font-bold">Mi perfil profesional</h1><Card><CardContent className="space-y-5 p-6"><div><h2 className="text-2xl font-bold">{technician.displayName}</h2><div className="mt-3"><StatusBadge status={technician.status} /></div></div><p>{technician.headline}</p><p className="text-muted-foreground">{technician.bio}</p><p>Especialidades declaradas: {technician.specialties.join(", ") || "Sin informar"}</p><p>Cobertura declarada: {technician.coverageAreas.join(", ") || "Sin informar"}</p><p>Experiencia declarada: {technician.yearsOfExperience} años</p><p className="text-sm text-muted-foreground">Preferencia de urgencias: {technician.emergencyEnabled ? "declarada por el técnico" : "no declarada"}. El servicio de urgencias no está habilitado.</p>{published ? <Link className="font-semibold text-primary" href={`/tecnicos/${technician.slug}`}>Ver perfil público</Link> : <p className="text-sm text-muted-foreground">Tu perfil no está publicado. Administración debe revisar y aprobar tu postulación.</p>}</CardContent></Card></TechnicianDashboardShell>;
}
