import Link from "next/link";
import { JobOperationsService } from "@/services/jobs/job-operations-service";
import { JobShell, type JobArea } from "./job-shell";
import { jobLabels } from "./job-labels";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
const states = ["awarded", "coordination_pending", "date_proposed", "scheduled", "ready", "in_progress", "completion_reported", "completed", "cancelled", "disputed"];
export async function JobList({ area, searchParams }: { readonly area: JobArea; readonly searchParams: Promise<{ page?: string; state?: string }> }) {
  const q = await searchParams, page = Math.min(10000, Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1)), state = states.includes(q.state ?? "") ? q.state : undefined;
  // Authorization happens before data loading, in addition to participant/RBAC filtering in the RPC.
  const { requireServerRole } = await import("@/services/auth/server-authentication-service");
  await requireServerRole(area === "admin" ? ["moderator", "superadmin"] : [area === "cliente" ? "customer" : "technician"]);
  const result = await new JobOperationsService().list(page, state), root = `/${area}/trabajos`;
  return <JobShell area={area}><h1 className="text-3xl font-bold">{area === "admin" ? "Gestión de trabajos" : "Mis trabajos"}</h1><p className="mt-3 text-muted-foreground">Coordina fechas, consulta avances y gestiona incidencias. Una adjudicación no confirma un pago.</p>
    <form className="my-6 flex flex-wrap items-end gap-3"><label className="grid gap-1 text-sm font-medium">Estado<select aria-label="Estado" name="state" defaultValue={state ?? ""} className="h-10 max-w-full rounded-lg border bg-background px-3"><option value="">Todos</option>{states.map(s => <option key={s} value={s}>{jobLabels[s]}</option>)}</select></label><Button variant="outline">Filtrar</Button></form>
    <p className="mb-4 text-sm text-muted-foreground">{result.total} trabajos con este filtro · página {page}. Los avisos de cada tarjeta corresponden al estado guardado.</p>
    {result.items.length ? <div className="grid gap-4 lg:grid-cols-2">{result.items.map(({ job, title, commune, customerName, technicianName, activeIncident, cancellationPending, executionEnabled }) => <Card key={job.id}><CardContent className="space-y-3 p-5"><StatusBadge status={job.status} /><h2 className="break-words text-xl font-bold"><Link href={`${root}/${job.id}`} className="underline decoration-primary/40 underline-offset-4">{title}</Link></h2><p>{commune}</p><p className="break-words text-sm">Cliente: {customerName} · Técnico: {technicianName}</p>{activeIncident ? <p className="text-sm font-semibold">Reclamo pendiente</p> : null}{cancellationPending ? <p className="text-sm font-semibold">Cancelación en revisión</p> : null}{!executionEnabled && !["completed", "cancelled"].includes(job.status) ? <p className="text-sm text-muted-foreground">Ejecución bloqueada por política comercial.</p> : null}</CardContent></Card>)}</div> : <Card><CardContent className="p-6">No hay trabajos en esta página. Las cotizaciones adjudicadas aparecerán aquí.</CardContent></Card>}
    <nav aria-label="Páginas de trabajos" className="mt-6 flex flex-wrap gap-5">{page > 1 ? <Link href={`${root}?page=${page - 1}&state=${state ?? ""}`}>Anterior</Link> : null}{page * 20 < result.total ? <Link href={`${root}?page=${page + 1}&state=${state ?? ""}`}>Siguiente</Link> : null}</nav>
  </JobShell>;
}
