import Link from "next/link";
import { TechnicianDashboardShell } from "@/components/technicians/technician-dashboard-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getServerAuthenticatedUser } from "@/services/auth/server-authentication-service";
import { TechnicianDashboardService } from "@/services/technicians/technician-dashboard-service";

export default async function TechnicianDashboardPage() {
  const user = await getServerAuthenticatedUser();
  if (!user) return null;
  const overview = await new TechnicianDashboardService().getOverview(user.id);
  return <TechnicianDashboardShell activeHref="/tecnico"><h1 className="text-3xl font-bold">Hola, {user.name.split(" ").at(0)}</h1><p className="mb-7 mt-3 text-muted-foreground">Consulta el estado de tu postulación y tus datos profesionales.</p>{overview ? <Card><CardHeader><CardTitle>Estado de tu perfil</CardTitle></CardHeader><CardContent className="space-y-4"><StatusBadge status={overview.technician.status} /><p className="text-sm text-muted-foreground">{overview.technician.coverageAreas.length ? `Cobertura declarada: ${overview.technician.coverageAreas.join(", ")}.` : "Aún no has informado zonas de cobertura."}</p><Link className="font-semibold text-primary" href="/tecnico/perfil">Revisar mi perfil</Link></CardContent></Card> : <EmptyState title="No encontramos tu perfil técnico" description="Tu cuenta no tiene una postulación técnica disponible. Contacta a administración para revisar el registro." />}<div className="mt-5"><EmptyState title="Contratación y pagos en preparación" description="Las oportunidades, los trabajos y los ingresos se mostrarán cuando su gestión esté habilitada. No hay indicadores comerciales disponibles por ahora." /></div></TechnicianDashboardShell>;
}
