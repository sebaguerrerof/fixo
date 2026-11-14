"use client";

import { CheckCircle2, History, Save, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { StatusBadge, technicianStatusLabel } from "@/components/shared/status-badge";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Select, Textarea } from "@/components/ui/field";
import type { AdminAuditEntry } from "@/domain/entities/audit-log";
import type { Technician } from "@/domain/entities/technician";
import { availableTechnicianTransitions, type TechnicianStatus } from "@/domain/enums/technician-status";
import { getAdminManagementStore } from "@/services/admin/admin-management-store-factory";

export function TechnicianDetailManagement({ initialTechnician }: { readonly initialTechnician: Technician }) {
  const [technician, setTechnician] = useState<Technician>(initialTechnician);
  const [nextStatus, setNextStatus] = useState<TechnicianStatus | "">("");
  const [reason, setReason] = useState("");
  const [auditEntries, setAuditEntries] = useState<AdminAuditEntry[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    void getAdminManagementStore().readAuditEntries(initialTechnician.id).then((entries) => {
      if (isMounted) setAuditEntries(entries);
    }).catch(() => { if (isMounted) setFeedback("No pudimos cargar el historial administrativo."); });
    return () => { isMounted = false; };
  }, [initialTechnician]);

  const availableTransitions = useMemo(() => availableTechnicianTransitions(technician.status), [technician.status]);

  async function submitStatusChange(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!nextStatus) return;

    try {
      const updatedTechnician = await getAdminManagementStore().changeTechnicianStatus(technician, nextStatus, reason);
      setTechnician(updatedTechnician);
      setAuditEntries(await getAdminManagementStore().readAuditEntries(technician.id));
      setFeedback(`Estado actualizado a ${technicianStatusLabel(nextStatus).toLocaleLowerCase("es-CL")}.`);
      setReason("");
      setNextStatus("");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "No se pudo actualizar el perfil.");
    }
  }

  return <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"><div className="space-y-5"><Card><CardContent className="p-6"><div className="flex flex-col gap-5 sm:flex-row sm:items-center"><Avatar className="size-16 text-lg" name={technician.displayName} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold">{technician.displayName}</h1><StatusBadge status={technician.status} /></div><p className="mt-1 text-muted-foreground">{technician.headline}</p><div className="mt-4 flex flex-wrap gap-2">{technician.specialties.map((specialty) => <Badge key={specialty} variant="secondary">{specialty}</Badge>)}</div></div></div><div className="mt-6 grid gap-4 border-t pt-5 sm:grid-cols-3"><div><p className="text-xl font-bold">{technician.metrics.completedJobs}</p><p className="text-sm text-muted-foreground">servicios realizados</p></div><div><p className="text-xl font-bold">{technician.metrics.rating > 0 ? technician.metrics.rating.toFixed(1) : "—"}</p><p className="text-sm text-muted-foreground">rating actual</p></div><div><p className="text-xl font-bold">{technician.metrics.completionRate || "—"}{technician.metrics.completionRate ? "%" : ""}</p><p className="text-sm text-muted-foreground">tasa de finalización</p></div></div></CardContent></Card><Card><CardHeader><CardTitle>Antecedentes del perfil</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><div className="rounded-xl bg-muted/60 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cobertura</p><p className="mt-2 text-sm font-medium">{technician.coverageAreas.join(" · ")}</p></div><div className="rounded-xl bg-muted/60 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Atención urgente</p><p className="mt-2 text-sm font-medium">{technician.emergencyEnabled ? "Habilitada" : "No habilitada"}</p></div><div className="rounded-xl bg-muted/60 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Experiencia</p><p className="mt-2 text-sm font-medium">{technician.yearsOfExperience} años</p></div><div className="rounded-xl bg-muted/60 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Respuesta habitual</p><p className="mt-2 text-sm font-medium">{technician.metrics.responseTimeMinutes} minutos</p></div></CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2"><History className="size-5 text-primary" />Historial administrativo</CardTitle></CardHeader><CardContent className="space-y-4">{auditEntries.length ? auditEntries.map((entry) => <div key={entry.id} className="border-l-2 border-primary/25 pl-4"><p className="text-sm font-semibold">{technicianStatusLabel(entry.previousStatus)} → {technicianStatusLabel(entry.nextStatus)}</p><p className="mt-1 text-sm text-muted-foreground">{entry.reason}</p><p className="mt-2 text-xs text-muted-foreground">{new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.createdAt))} · {entry.actorName}</p></div>) : <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">Aún no hay acciones registradas para este perfil.</p>}</CardContent></Card></div><aside><Card className="lg:sticky lg:top-24"><CardHeader><CardTitle>Gestionar estado</CardTitle></CardHeader><CardContent><p className="text-sm leading-6 text-muted-foreground">Cada ajuste queda registrado en el historial administrativo de la plataforma.</p><form className="mt-5 space-y-4" onSubmit={submitStatusChange}><Field htmlFor="nextStatus" label="Nuevo estado"><Select id="nextStatus" onChange={(event) => setNextStatus(event.target.value as TechnicianStatus | "")} value={nextStatus}><option value="">Selecciona una acción</option>{availableTransitions.map((status) => <option key={status} value={status}>{technicianStatusLabel(status)}</option>)}</Select></Field><Field htmlFor="reason" label="Motivo"><Textarea id="reason" onChange={(event) => setReason(event.target.value)} placeholder="Agrega contexto para el equipo de operaciones." value={reason} /></Field>{feedback ? <div aria-live="polite"><Alert tone="info">{feedback}</Alert></div> : null}<Button className="w-full" disabled={!nextStatus} type="submit">{nextStatus === "active" || nextStatus === "verified" ? <CheckCircle2 aria-hidden="true" className="size-4" /> : <ShieldAlert aria-hidden="true" className="size-4" />}<Save aria-hidden="true" className="size-4" />Guardar cambio</Button></form></CardContent></Card></aside></div>;
}
