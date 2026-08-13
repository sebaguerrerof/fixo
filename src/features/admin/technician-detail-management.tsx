"use client";

import { CheckCircle2, History, Save, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { StatusBadge, technicianStatusLabel } from "@/components/shared/status-badge";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminAuditEntry } from "@/domain/entities/audit-log";
import type { Technician } from "@/domain/entities/technician";
import { availableTechnicianTransitions, type TechnicianStatus } from "@/domain/enums/technician-status";
import { LocalAdminManagementStore } from "@/services/admin/local-admin-management-store";

export function TechnicianDetailManagement({ initialTechnician }: { readonly initialTechnician: Technician }) {
  const [technician, setTechnician] = useState<Technician>(initialTechnician);
  const [nextStatus, setNextStatus] = useState<TechnicianStatus | "">("");
  const [reason, setReason] = useState("");
  const [auditEntries, setAuditEntries] = useState<AdminAuditEntry[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const store = new LocalAdminManagementStore();
    const hydrated = store.hydrateTechnicians([initialTechnician]).at(0);
    if (hydrated) setTechnician(hydrated);
    setAuditEntries(store.readAuditEntries().filter((entry) => entry.technicianId === initialTechnician.id));
  }, [initialTechnician]);

  const availableTransitions = useMemo(() => availableTechnicianTransitions(technician.status), [technician.status]);

  function submitStatusChange(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!nextStatus) return;

    try {
      const result = new LocalAdminManagementStore().changeTechnicianStatus(technician, nextStatus, reason);
      setTechnician(result.technician);
      setAuditEntries((entries) => [result.auditEntry, ...entries]);
      setFeedback(`Estado actualizado a ${technicianStatusLabel(nextStatus).toLocaleLowerCase("es-CL")}.`);
      setReason("");
      setNextStatus("");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "No se pudo actualizar el perfil.");
    }
  }

  return <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"><div className="space-y-5"><Card><CardContent className="p-6"><div className="flex flex-col gap-5 sm:flex-row sm:items-center"><Avatar className="size-16 text-lg" name={technician.displayName} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold">{technician.displayName}</h1><StatusBadge status={technician.status} /></div><p className="mt-1 text-muted-foreground">{technician.headline}</p><div className="mt-4 flex flex-wrap gap-2">{technician.specialties.map((specialty) => <Badge key={specialty} variant="secondary">{specialty}</Badge>)}</div></div></div><div className="mt-6 grid gap-4 border-t pt-5 sm:grid-cols-3"><div><p className="text-xl font-bold">{technician.metrics.completedJobs}</p><p className="text-sm text-muted-foreground">servicios realizados</p></div><div><p className="text-xl font-bold">{technician.metrics.rating > 0 ? technician.metrics.rating.toFixed(1) : "—"}</p><p className="text-sm text-muted-foreground">rating actual</p></div><div><p className="text-xl font-bold">{technician.metrics.completionRate || "—"}{technician.metrics.completionRate ? "%" : ""}</p><p className="text-sm text-muted-foreground">tasa de finalización</p></div></div></CardContent></Card><Card><CardHeader><CardTitle>Antecedentes del perfil</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><div className="rounded-xl bg-muted/60 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cobertura</p><p className="mt-2 text-sm font-medium">{technician.coverageAreas.join(" · ")}</p></div><div className="rounded-xl bg-muted/60 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Atención urgente</p><p className="mt-2 text-sm font-medium">{technician.emergencyEnabled ? "Habilitada" : "No habilitada"}</p></div><div className="rounded-xl bg-muted/60 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Experiencia</p><p className="mt-2 text-sm font-medium">{technician.yearsOfExperience} años</p></div><div className="rounded-xl bg-muted/60 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Respuesta habitual</p><p className="mt-2 text-sm font-medium">{technician.metrics.responseTimeMinutes} minutos</p></div></CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2"><History className="size-5 text-primary" />Historial administrativo</CardTitle></CardHeader><CardContent className="space-y-4">{auditEntries.length ? auditEntries.map((entry) => <div key={entry.id} className="border-l-2 border-primary/25 pl-4"><p className="text-sm font-semibold">{technicianStatusLabel(entry.previousStatus)} → {technicianStatusLabel(entry.nextStatus)}</p><p className="mt-1 text-sm text-muted-foreground">{entry.reason}</p><p className="mt-2 text-xs text-muted-foreground">{new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.createdAt))} · {entry.actorName}</p></div>) : <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">Aún no hay acciones registradas para este perfil desde este navegador.</p>}</CardContent></Card></div><aside><Card className="sticky top-6"><CardHeader><CardTitle>Gestionar estado</CardTitle></CardHeader><CardContent><p className="text-sm leading-6 text-muted-foreground">Cada ajuste queda registrado en el historial administrativo de este entorno.</p><form className="mt-5 space-y-4" onSubmit={submitStatusChange}><label className="block space-y-2"><span className="text-sm font-semibold">Nuevo estado</span><select className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" onChange={(event) => setNextStatus(event.target.value as TechnicianStatus | "")} value={nextStatus}><option value="">Selecciona una acción</option>{availableTransitions.map((status) => <option key={status} value={status}>{technicianStatusLabel(status)}</option>)}</select></label><label className="block space-y-2"><span className="text-sm font-semibold">Motivo</span><textarea className="min-h-28 w-full rounded-xl border bg-background p-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring" onChange={(event) => setReason(event.target.value)} placeholder="Agrega contexto para el equipo de operaciones." value={reason} /></label>{feedback ? <p aria-live="polite" className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">{feedback}</p> : null}<Button className="w-full" disabled={!nextStatus} type="submit">{nextStatus === "active" || nextStatus === "verified" ? <CheckCircle2 className="size-4" /> : <ShieldAlert className="size-4" />}<Save className="size-4" />Guardar cambio</Button></form></CardContent></Card></aside></div>;
}
