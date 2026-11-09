import { TechnicianDashboardShell } from "@/components/technicians/technician-dashboard-shell";
import { StatusBadge } from "@/components/shared/status-badge";
import { JobProgressActions } from "@/components/technicians/job-progress-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireServerRole } from "@/services/auth/server-authentication-service";
import { TechnicianJobsService } from "@/services/technicians/technician-jobs-service";
import { formatClp } from "@/lib/utils";
export default async function TechnicianJobsPage() {
  const user = await requireServerRole(["technician"]);
  const jobs = await new TechnicianJobsService().listActiveJobs(user.id);
  return <TechnicianDashboardShell activeHref="/tecnico/trabajos"><h1 className="text-3xl font-bold">Trabajos adjudicados</h1><p className="mt-3 text-muted-foreground">Consulta las condiciones guardadas. La ejecución y los pagos todavía no están habilitados.</p>
    {jobs.length ? <div className="mt-7 grid gap-5 lg:grid-cols-2">{jobs.map(({ job, title, locationLabel }) => <Card key={job.id}>
      <CardHeader><CardTitle>{title}</CardTitle><StatusBadge status={job.status} /></CardHeader>
      <CardContent className="space-y-3"><p>{locationLabel}</p>{job.snapshot ? <><p className="font-semibold">{formatClp(job.snapshot.priceClp)}</p><p className="text-sm">{job.snapshot.description}</p><p className="text-sm">{job.snapshot.conditions}</p></> : null}
      {job.status === "awarded" ? <p className="text-sm text-muted-foreground">Pago no habilitado. Ejecución pendiente del siguiente sprint.</p> : <JobProgressActions isEmergencyAwaitingCustomer={Boolean(job.emergencyId) && job.status === "scheduled"} jobId={job.id} status={job.status} />}
      </CardContent></Card>)}</div> : <Card className="mt-7"><CardContent className="p-6">No tienes trabajos adjudicados en este momento.</CardContent></Card>}
  </TechnicianDashboardShell>;
}
