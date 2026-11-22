import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { TechnicianDashboardShell } from "@/components/technicians/technician-dashboard-shell";
import { VerificationSummary } from "@/components/technicians/verification-summary";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProfessionalApplication } from "@/domain/technicians/application";
import { loadProfessionalApplication } from "@/services/technicians/professional-application-service";
import { getServerAuthenticatedUser } from "@/services/auth/server-authentication-service";
import { TechnicianDashboardService } from "@/services/technicians/technician-dashboard-service";

export default async function TechnicianProfilePage() {
  const user = await getServerAuthenticatedUser();
  if (!user) return null;
  const overview = await new TechnicianDashboardService().getOverview(user.id);
  if (!overview) return <TechnicianDashboardShell activeHref="/tecnico/perfil"><EmptyState title="Perfil técnico no disponible" description="No encontramos una postulación asociada a tu cuenta." /></TechnicianDashboardShell>;
  const { technician } = overview;
  const published = ["verified", "active"].includes(technician.status);
  // The application (documents and review state) needs the real database; without it the summary is simply left out.
  let application: ProfessionalApplication | null = null;
  try { application = await loadProfessionalApplication(); } catch { application = null; }
  return (
    <TechnicianDashboardShell activeHref="/tecnico/perfil">
      <PageHeader
        actions={published ? <Link className={buttonVariants({ variant: "outline" })} href={`/tecnicos/${technician.slug}`}>Ver perfil público</Link> : undefined}
        description="Así te ve la plataforma. Para cambiar estos datos usa Mi postulación; tus datos de contacto están en Editar mi cuenta."
        title="Mi perfil profesional"
      />
      <div className="mt-8 grid max-w-3xl gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{technician.displayName}</CardTitle>
            <div className="mt-2"><StatusBadge status={technician.status} /></div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>{technician.headline}</p>
            <p className="text-muted-foreground">{technician.bio}</p>
            <p>Especialidades declaradas: {technician.specialties.join(", ") || "Sin informar"}</p>
            <p>Cobertura declarada: {technician.coverageAreas.join(", ") || "Sin informar"}</p>
            <p>Experiencia declarada: {technician.yearsOfExperience} años</p>
            <p className="text-sm text-muted-foreground">Preferencia de urgencias: {technician.emergencyEnabled ? "declarada por el técnico" : "no declarada"}. El servicio de urgencias no está habilitado.</p>
            {published ? null : <p className="text-sm text-muted-foreground">Tu perfil no está publicado. Administración debe revisar y aprobar tu postulación.</p>}
          </CardContent>
        </Card>
        {application ? <VerificationSummary application={application} /> : null}
      </div>
    </TechnicianDashboardShell>
  );
}
