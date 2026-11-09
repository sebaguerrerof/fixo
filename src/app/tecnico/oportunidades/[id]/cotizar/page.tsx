import { notFound } from "next/navigation";
import { getServerAuthenticatedUser } from "@/services/auth/server-authentication-service";

import { CreateQuoteForm } from "@/components/technicians/create-quote-form";
import { TechnicianDashboardShell } from "@/components/technicians/technician-dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getServiceRequestRepository, getQuoteRepository } from "@/repositories/repository-factory";

export default async function CreateQuotePage({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  const request = await getServiceRequestRepository().findById(id);
  if (!request) notFound();
  const user = await getServerAuthenticatedUser();
  if (!user || user.role !== "technician") notFound();
  const draft = (await getQuoteRepository().listByServiceRequest(id)).find(q => q.technicianId === user.id);
  if (draft && !["draft", "withdrawn"].includes(draft.status)) notFound();

  return <TechnicianDashboardShell activeHref="/tecnico/oportunidades">
    <div><p className="text-sm font-semibold text-primary">Nueva cotización</p><h1 className="mt-1 text-3xl font-bold tracking-tight">{request.title}</h1><p className="mt-3 max-w-2xl leading-7 text-muted-foreground">{request.description}</p></div>
    <Card className="mt-7"><CardHeader><CardTitle>Detalle de tu propuesta</CardTitle></CardHeader><CardContent><CreateQuoteForm serviceRequestId={request.id} draft={draft} /></CardContent></Card>
  </TechnicianDashboardShell>;
}
