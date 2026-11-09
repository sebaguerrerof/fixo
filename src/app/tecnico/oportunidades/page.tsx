import { WithdrawQuoteButton } from "@/components/technicians/withdraw-quote-button";
import { Clock3, MapPin, Send, Zap } from "lucide-react";
import Link from "next/link";

import { AcceptEmergencyButton } from "@/components/technicians/accept-emergency-button";
import { StatusBadge } from "@/components/shared/status-badge";
import { TechnicianDashboardShell } from "@/components/technicians/technician-dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getServerAuthenticatedUser } from "@/services/auth/server-authentication-service";
import { EmergencyService } from "@/services/emergencies/emergency-service";
import { TechnicianOpportunitiesService } from "@/services/technicians/technician-opportunities-service";
import { isDemoModeEnabled } from "@/config/demo-mode";

const dateFormatter = new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short" });

export default async function TechnicianOpportunitiesPage() {
  const user = await getServerAuthenticatedUser();
  if (!user) return null;
  const [opportunities, emergencies] = await Promise.all([
    new TechnicianOpportunitiesService().listOpportunities(user.id),
    isDemoModeEnabled() ? new EmergencyService().listBroadcastingOpportunities(user.id) : Promise.resolve([]),
  ]);

  return <TechnicianDashboardShell activeHref="/tecnico/oportunidades"><div><p className="text-sm font-semibold text-primary">Oportunidades compatibles</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Nuevas solicitudes</h1><p className="mt-3 max-w-2xl leading-7 text-muted-foreground">Revisa solo solicitudes relacionadas con tus especialidades, cobertura y disponibilidad declarada.</p></div>

    {emergencies.length > 0 ? <div className="mt-7"><h2 className="text-lg font-bold">Urgencias que te convocan</h2><div className="mt-3 grid gap-4">{emergencies.map((emergency) => <Card className="border-rose-200" key={emergency.id}><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><CardTitle>Urgencia</CardTitle><Badge variant="danger"><Zap className="mr-1 size-3.5 fill-current" />Urgente</Badge></div><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground"><span className="inline-flex items-center gap-1"><MapPin className="size-4" />{emergency.locationLabel}</span></div></div></div></CardHeader><CardContent><p className="text-sm leading-6 text-muted-foreground">{emergency.description}</p><div className="mt-5"><AcceptEmergencyButton emergencyId={emergency.id} /></div></CardContent></Card>)}</div></div> : null}

    {opportunities.length === 0 ? <Card className="mt-7"><CardContent className="p-6 text-sm text-muted-foreground">No hay solicitudes abiertas para tus rubros en este momento.</CardContent></Card> : <div className="mt-7 grid gap-4">{opportunities.map(({ request, existingQuote }) => <Card key={request.id} className="motion-card"><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><CardTitle>{request.title}</CardTitle>{request.priority === "urgent" ? <Badge variant="danger"><Zap className="mr-1 size-3.5 fill-current" />Urgente</Badge> : <Badge variant="secondary">Servicio regular</Badge>}<StatusBadge status={request.status} /></div><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground"><span className="inline-flex items-center gap-1"><MapPin className="size-4" />{request.locationLabel}</span><span className="inline-flex items-center gap-1"><Clock3 className="size-4" />{dateFormatter.format(new Date(request.createdAt))}</span></div></div></div></CardHeader><CardContent><p className="text-sm leading-6 text-muted-foreground">{request.description}</p><div className="mt-5 flex flex-wrap items-center gap-2">{existingQuote ? <div className="flex flex-wrap items-center gap-3"><span>Tu cotización: <StatusBadge status={existingQuote.status} /></span>{existingQuote.status === "submitted" ? <WithdrawQuoteButton id={existingQuote.id} /> : null}{["draft", "withdrawn"].includes(existingQuote.status) ? <Link className={buttonVariants({ size: "sm", variant: "outline" })} href={`/tecnico/oportunidades/${request.id}/cotizar`}>Retomar borrador</Link> : null}</div> : <Link className={buttonVariants({ size: "sm" })} href={`/tecnico/oportunidades/${request.id}/cotizar`}><Send className="size-4" />Enviar cotización</Link>}</div></CardContent></Card>)}</div>}
  </TechnicianDashboardShell>;
}
