import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ProfessionalApplicationForm } from "@/components/technicians/professional-application-form";
import { TechnicianDashboardShell } from "@/components/technicians/technician-dashboard-shell";
import { buttonVariants } from "@/components/ui/button";
import { TechnicianDirectoryService } from "@/services/technicians/technician-directory-service";
import { getServerAuthenticatedUser } from "@/services/auth/server-authentication-service";
import { loadProfessionalApplication, loadProfessionalCategories, loadProfessionalRequirements } from "@/services/technicians/professional-application-service";

export const metadata = { title: "Mi perfil profesional" };

/**
 * The technician's single professional page: status and the reviewer's notes, the declared data (editable while the application
 * allows it), the documents and the history. It reads the application itself, so it also works before any category is chosen.
 */
export default async function TechnicianProfilePage() {
  const application = await loadProfessionalApplication();
  const categories = await loadProfessionalCategories();
  const requirements = application?.primary_category ? await loadProfessionalRequirements(application.primary_category) : [];
  let publicHref: string | null = null;
  if (application?.published) {
    const user = await getServerAuthenticatedUser();
    const technician = user ? await new TechnicianDirectoryService().getByUserId(user.id).catch(() => null) : null;
    if (technician) publicHref = `/tecnicos/${technician.slug}`;
  }
  return (
    <TechnicianDashboardShell activeHref="/tecnico/perfil">
      <PageHeader
        actions={publicHref ? <Link className={buttonVariants({ variant: "outline" })} href={publicHref}>Ver perfil público</Link> : undefined}
        description="Tus datos profesionales, tus documentos y el estado de la revisión, en un solo lugar. Tus datos de contacto están en Editar mi cuenta."
        title="Mi perfil profesional"
      />
      <div className="mt-8 max-w-3xl">
        {application
          ? <ProfessionalApplicationForm application={application} categories={categories} requirements={requirements} />
          : <EmptyState description="No encontramos una postulación asociada a tu cuenta." title="Perfil técnico no disponible" />}
      </div>
    </TechnicianDashboardShell>
  );
}
