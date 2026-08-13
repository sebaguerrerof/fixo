"use client";

import { ArrowUpRight, CheckCircle2, Search, ShieldAlert, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { StatusBadge, technicianStatusLabel } from "@/components/shared/status-badge";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Technician } from "@/domain/entities/technician";
import type { TechnicianStatus } from "@/domain/enums/technician-status";
import { LocalAdminManagementStore } from "@/services/admin/local-admin-management-store";

const filters: readonly { readonly value: "all" | TechnicianStatus; readonly label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "pending_verification", label: "Pendientes" },
  { value: "verified", label: "Verificados" },
  { value: "active", label: "Activos" },
  { value: "temporarily_suspended", label: "Restringidos" },
];

function recommendedAction(status: TechnicianStatus): { readonly next: TechnicianStatus; readonly label: string } | null {
  switch (status) {
    case "pending_verification": return { next: "verified", label: "Verificar" };
    case "verified": return { next: "active", label: "Activar" };
    case "active": return { next: "temporarily_suspended", label: "Suspender" };
    case "temporarily_suspended":
    case "suspended": return { next: "active", label: "Reactivar" };
    case "needs_information": return { next: "pending_verification", label: "Revisar de nuevo" };
    case "rejected": return { next: "pending_verification", label: "Reabrir" };
    default: return null;
  }
}

export function TechnicianManagementPanel({ initialTechnicians }: { readonly initialTechnicians: readonly Technician[] }) {
  const [technicians, setTechnicians] = useState<Technician[]>([...initialTechnicians]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | TechnicianStatus>("all");
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => setTechnicians(new LocalAdminManagementStore().hydrateTechnicians(initialTechnicians)), [initialTechnicians]);

  const filteredTechnicians = useMemo(() => technicians.filter((technician) => {
    const visibleText = `${technician.displayName} ${technician.city} ${technician.headline}`.toLocaleLowerCase("es-CL");
    return visibleText.includes(query.toLocaleLowerCase("es-CL")) && (filter === "all" || technician.status === filter);
  }), [filter, query, technicians]);

  function applyQuickAction(technician: Technician, nextStatus: TechnicianStatus, label: string): void {
    try {
      const result = new LocalAdminManagementStore().changeTechnicianStatus(technician, nextStatus, `Acción rápida: ${label.toLocaleLowerCase("es-CL")}.`);
      setTechnicians((current) => current.map((item) => item.id === technician.id ? result.technician : item));
      setFeedback(`${technician.displayName} ahora está ${technicianStatusLabel(nextStatus).toLocaleLowerCase("es-CL")}.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "No se pudo actualizar el técnico.");
    }
  }

  return <div className="space-y-5"><div className="flex flex-col gap-3 rounded-2xl border bg-card p-3 shadow-soft lg:flex-row"><label className="flex min-w-0 flex-1 items-center gap-3 px-3"><Search className="size-5 text-primary" /><span className="sr-only">Buscar técnico</span><input className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, comuna o especialidad" value={query} /></label><div className="flex gap-2 overflow-x-auto"><SlidersHorizontal className="mt-2.5 size-4 shrink-0 text-muted-foreground" />{filters.map((item) => <button className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold transition ${filter === item.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground"}`} key={item.value} onClick={() => setFilter(item.value)} type="button">{item.label}</button>)}</div></div>{feedback ? <p aria-live="polite" className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-900">{feedback}</p> : null}<div className="grid gap-4">{filteredTechnicians.map((technician) => { const action = recommendedAction(technician.status); return <Card key={technician.id} className="overflow-hidden"><CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center"><div className="flex min-w-0 flex-1 items-center gap-3"><Avatar name={technician.displayName} className="size-11" /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-bold">{technician.displayName}</p><StatusBadge status={technician.status} /></div><p className="mt-1 truncate text-sm text-muted-foreground">{technician.headline}</p><p className="mt-1 text-xs text-muted-foreground">{technician.city} · {technician.metrics.completedJobs} servicios · {technician.metrics.rating > 0 ? `${technician.metrics.rating.toFixed(1)} de rating` : "Sin evaluaciones"}</p></div></div><div className="flex flex-wrap gap-2">{action ? <Button onClick={() => applyQuickAction(technician, action.next, action.label)} size="sm" variant={action.next === "temporarily_suspended" ? "destructive" : "default"}>{action.next === "verified" || action.next === "active" ? <CheckCircle2 className="size-4" /> : <ShieldAlert className="size-4" />}{action.label}</Button> : null}<Link className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-semibold transition hover:bg-accent" href={`/admin/tecnicos/${technician.slug}`}>Gestionar <ArrowUpRight className="size-4" /></Link></div></CardContent></Card>; })}</div>{filteredTechnicians.length === 0 ? <Card><CardContent className="py-12 text-center"><h2 className="font-bold">No encontramos técnicos con esos filtros</h2><p className="mt-2 text-sm text-muted-foreground">Prueba una búsqueda distinta o vuelve a ver todos los perfiles.</p></CardContent></Card> : null}</div>;
}
