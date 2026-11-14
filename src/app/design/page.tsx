import { notFound } from "next/navigation";

import { AccountControls } from "@/components/admin/account-controls";
import { InvitationsPanel } from "@/components/admin/invitations-panel";
import { ProfessionalDecisionForm, RequirementVersionForm } from "@/components/admin/professional-review";
import { ProfileForm, type OwnProfile } from "@/components/auth/profile-form";
import { EmergencyWizard } from "@/components/emergencies/emergency-wizard";
import { JobCommandForm, JobFieldInput, JobFieldSelect, JobMessage, JobReason } from "@/components/jobs/job-command-form";
import { JobEvidenceForm } from "@/components/jobs/job-evidence-form";
import { ExtraChargeProposalForm } from "@/components/payments/extra-charge-proposal-form";
import { ExtraChargeResponse } from "@/components/payments/extra-charge-response";
import { FeePolicyForm } from "@/components/payments/fee-policy-form";
import { PaymentCheckoutButton } from "@/components/payments/payment-checkout-button";
import { CancelRequestButton, RequestPhotoForm } from "@/components/service-requests/request-actions";
import { CreateQuoteForm } from "@/components/technicians/create-quote-form";
import { ProfessionalApplicationForm } from "@/components/technicians/professional-application-form";
import { SiteHeader } from "@/components/layout/site-header";
import { isDemoModeEnabled } from "@/config/demo-mode";
import type { ProfessionalApplication, ProfessionalRequirement } from "@/domain/technicians/application";

export const metadata = { title: "Catálogo de componentes", robots: { index: false, follow: false } };

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const categories = [{ id: "electricidad", name: "Electricidad" }, { id: "gasfiteria", name: "Gasfitería" }, { id: "cerrajeria", name: "Cerrajería" }];

const application: ProfessionalApplication = {
  technician_id: ID(1), revision: 3, state: "needs_information", primary_category: "electricidad", availability: "Lunes a viernes, 9 a 18 h", portfolio: ["https://ejemplo.cl/trabajo-1"], review_reason: "Falta un antecedente del rubro.", published: false, name: "Camila Rojas",
  profile: { city: "Providencia", headline: "Electricista certificada", bio: "Instalaciones residenciales y revisión de tableros.", coverage_areas: ["Providencia", "Ñuñoa"], years_of_experience: 9, starting_price_clp: 25000, status: "active" },
  categories: ["electricidad"], specialties: ["Tableros eléctricos", "Cortocircuitos"],
  documents: [{ id: ID(2), requirement_id: ID(3), document_type: "identity", status: "pending", inspection_status: "clean", inspection_engine: null, current_document: true, review_reason: null, created_at: "2026-11-10T12:00:00Z" }],
  history: [{ id: ID(4), actor_id: null, action: "submit", previous_state: "draft", next_state: "submitted", reason: "Postulación enviada", created_at: "2026-11-09T12:00:00Z" }],
};
const requirements: ProfessionalRequirement[] = [{ id: ID(3), category_id: "electricidad", requirement_key: "antecedente-identidad", version: 1, kind: "internal", required: true, document_type: "identity", description: "Documento de identidad vigente", source_url: null }];
const profile: OwnProfile = { firstName: "Camila", lastName: "Rojas", phone: "+56911111111", email: "camila@ejemplo.cl", fullName: "Camila Rojas", role: "technician", accountStatus: "active", createdAt: "2026-08-01T00:00:00Z", termsAccepted: true, technician: { city: "Providencia", headline: "Electricista certificada", bio: "Bio de ejemplo", coverageAreas: "Providencia, Ñuñoa", status: "draft", categoryIds: ["electricidad"] } };
const invitations = [{ id: ID(5), email: "nuevo@ejemplo.cl", full_name: "Persona Nueva", role: "technician" as const, state: "pending", delivery: "enviado", expires_at: "2026-11-30T00:00:00Z", created_at: "2026-11-10T00:00:00Z" }];
const jobProps = { jobId: ID(6), revision: 1 };

function Section({ title, children }: { readonly title: string; readonly children: React.ReactNode }) {
  return <section className="space-y-5 border-t border-border pt-8"><h2 className="text-3xl">{title}</h2>{children}</section>;
}

/**
 * Component catalog with sample data: every form that normally sits behind a session or real persistence, rendered where the UI audit
 * (scripts/ui) can reach it. Development with NEXT_PUBLIC_DEMO_MODE=true only; any other environment gets a 404.
 */
export default function DesignCatalogPage() {
  if (!isDemoModeEnabled()) notFound();
  return (
    <>
      <SiteHeader />
      <main className="container space-y-12 py-10 pb-28">
        <header className="max-w-2xl"><h1 className="text-balance text-4xl leading-tight sm:text-5xl">Catálogo de componentes</h1><p className="mt-3 leading-7 text-muted-foreground">Formularios y paneles con datos de ejemplo. Solo existe en desarrollo con el modo demo activo; sirve para revisar el diseño y para que la auditoría de interfaz llegue a pantallas que normalmente requieren sesión o persistencia real.</p></header>
        <Section title="Postulación del técnico"><ProfessionalApplicationForm application={application} categories={categories} requirements={requirements} /></Section>
        <Section title="Perfil"><ProfileForm categories={categories} profile={profile} /></Section>
        <Section title="Cotización"><CreateQuoteForm serviceRequestId={ID(7)} /></Section>
        <Section title="Pagos">
          <div className="grid gap-5 lg:grid-cols-2">
            <PaymentCheckoutButton extraChargeId={null} jobId={ID(6)} platformFeeClp={5000} policyVersion={1} professionalAmountClp={50000} totalClp={55000} />
            <ExtraChargeResponse extraChargeId={ID(8)} jobId={ID(6)} platformFeeClp={1000} policyVersion={1} professionalAmountClp={10000} totalClp={11000} />
            <ExtraChargeProposalForm jobId={ID(6)} />
            <FeePolicyForm basisPoints={1000} version={2} />
          </div>
        </Section>
        <Section title="Trabajos y solicitudes">
          <div className="grid gap-5 lg:grid-cols-2">
            <JobCommandForm {...jobProps} action="propose_schedule" label="Proponer fecha">
              <JobFieldInput label="Fecha en Santiago" name="date" type="date" />
              <div className="grid grid-cols-2 gap-3"><JobFieldInput label="Desde" name="startTime" type="time" /><JobFieldInput label="Hasta" name="endTime" type="time" /></div>
              <JobFieldSelect label="Si se repite la hora de inicio" name="startChoice"><option value="">Solicitar aclaración si hay ambigüedad</option><option value="first">Primera ocurrencia</option></JobFieldSelect>
              <JobReason />
            </JobCommandForm>
            <JobCommandForm {...jobProps} action="progress" label="Informar avance"><JobMessage /></JobCommandForm>
            <JobEvidenceForm incidentId={ID(9)} jobId={ID(6)} />
            <RequestPhotoForm id={ID(10)} />
            <div><CancelRequestButton id={ID(10)} revision={1} /></div>
          </div>
        </Section>
        <Section title="Administración">
          <div className="grid gap-5 lg:grid-cols-2">
            <ProfessionalDecisionForm revision={3} state="submitted" target={ID(1)} />
            <RequirementVersionForm category="electricidad" />
          </div>
          <AccountControls id={ID(11)} isSelf={false} role="customer" superadmin />
          <InvitationsPanel enabled invitations={invitations} superadmin />
        </Section>
        <Section title="Urgencia (solo demo)"><div className="max-w-2xl"><EmergencyWizard isDemoMode /></div></Section>
      </main>
    </>
  );
}
