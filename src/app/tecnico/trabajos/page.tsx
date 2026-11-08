import { CheckCircle2, MapPin, MessageCircle } from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/shared/status-badge";
import { JobProgressActions } from "@/components/technicians/job-progress-actions";
import { TechnicianDashboardShell } from "@/components/technicians/technician-dashboard-shell";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getServerAuthenticatedUser } from "@/services/auth/server-authentication-service";
import { TechnicianJobsService } from "@/services/technicians/technician-jobs-service";

export default async function TechnicianJobsPage() {
  const user = await getServerAuthenticatedUser();
  if (!user) return null;
  const jobs = await new TechnicianJobsService().listActiveJobs(user.id);

  return <TechnicianDashboardShell activeHref="/tecnico/trabajos"><div><p className="text-sm font-semibold text-primary">Seguimiento del servicio</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Trabajos activos</h1><p className="mt-3 max-w-2xl leading-7 text-muted-foreground">Actualiza cada hito con claridad para mantener informado al cliente y conservar el historial del trabajo.</p></div>
    {jobs.length === 0 ? <Card className="mt-7"><CardContent className="p-6 text-sm text-muted-foreground">No tienes trabajos activos en este momento.</CardContent></Card> : <div className="mt-7 grid gap-5 lg:grid-cols-2">{jobs.map(({ job, title, locationLabel }) => <Card className="overflow-hidden" key={job.id}><div className="h-1.5 bg-gradient-to-r from-primary via-cyan-500 to-sky-500" /><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>{title}</CardTitle></div><StatusBadge status={job.status} /></div></CardHeader><CardContent><p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="size-4" />{locationLabel}</p><div className="mt-5 flex flex-wrap items-center gap-2"><JobProgressActions isEmergencyAwaitingCustomer={Boolean(job.emergencyId) && job.status === "scheduled"} jobId={job.id} status={job.status} /><Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/tecnico/trabajos"><MessageCircle className="size-4" />Abrir chat</Link></div></CardContent></Card>)}</div>}
    <Card className="mt-5"><CardContent className="flex items-start gap-3 p-5"><CheckCircle2 className="mt-0.5 size-5 text-success" /><div><h2 className="font-bold">Estados consistentes</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">La transición de un trabajo sigue una máquina de estados independiente de pagos y solicitudes, evitando estados inválidos o saltos no permitidos.</p></div></CardContent></Card>
  </TechnicianDashboardShell>;
}
