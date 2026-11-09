import { TechnicianDashboardShell } from "@/components/technicians/technician-dashboard-shell";
import { ProfessionalApplicationForm } from "@/components/technicians/professional-application-form";
import { loadProfessionalApplication,loadProfessionalCategories,loadProfessionalRequirements } from "@/services/technicians/professional-application-service";
export default async function ProfessionalApplicationPage(){
 const application=await loadProfessionalApplication();const categories=await loadProfessionalCategories();
 const requirements=application?.primary_category?await loadProfessionalRequirements(application.primary_category):[];
 return <TechnicianDashboardShell activeHref="/tecnico/postulacion"><h1 className="mb-6 text-3xl font-bold">Mi postulación profesional</h1>{application?<ProfessionalApplicationForm application={application} categories={categories} requirements={requirements}/>:<p>No encontramos una postulación asociada a tu cuenta.</p>}</TechnicianDashboardShell>;
}
