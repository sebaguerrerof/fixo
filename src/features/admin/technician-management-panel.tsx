"use client";

import { ArrowUpRight, CheckCircle2, Search, SearchX, ShieldAlert, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge, technicianStatusLabel } from "@/components/shared/status-badge";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Technician } from "@/domain/entities/technician";
import type { TechnicianStatus } from "@/domain/enums/technician-status";
import { getAdminManagementStore } from "@/services/admin/admin-management-store-factory";

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

  useEffect(() => {
    setTechnicians([...initialTechnicians]);
  }, [initialTechnicians]);

  const filteredTechnicians = useMemo(() => technicians.filter((technician) => {
    const visibleText = `${technician.displayName} ${technician.city} ${technician.headline}`.toLocaleLowerCase("es-CL");
    return visibleText.includes(query.toLocaleLowerCase("es-CL")) && (filter === "all" || technician.status === filter);
  }), [filter, query, technicians]);

  async function applyQuickAction(technician: Technician, nextStatus: TechnicianStatus, label: string): Promise<void> {
    try {
      const reason = `Acción rápida: ${label.toLocaleLowerCase("es-CL")}.`;
      const updatedTechnician = await getAdminManagementStore().changeTechnicianStatus(technician, nextStatus, reason);
      setTechnicians((current) => current.map((item) => item.id === technician.id ? updatedTechnician : item));
      setFeedback(`${technician.displayName} ahora está ${technicianStatusLabel(nextStatus).toLocaleLowerCase("es-CL")}.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "No se pudo actualizar el técnico.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="search-command flex flex-col gap-2 p-2 lg:flex-row lg:items-center" role="search">
        <label className="flex min-w-0 flex-1 items-center gap-3 px-3">
          <Search aria-hidden="true" className="size-5 shrink-0 text-primary" />
          <span className="sr-only">Buscar técnico</span>
          <input autoComplete="off" className="h-11 min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, comuna o especialidad" type="search" value={query} />
        </label>
        <div aria-label="Filtrar por estado" className="flex items-center gap-2 overflow-x-auto px-1 py-1 [scrollbar-width:none]" role="group">
          <SlidersHorizontal aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          {filters.map((item) => <Button aria-pressed={filter === item.value} className="shrink-0" key={item.value} onClick={() => setFilter(item.value)} size="sm" type="button" variant={filter === item.value ? "default" : "outline"}>{item.label}</Button>)}
        </div>
      </div>

      {feedback ? <div aria-live="polite"><Alert tone="info">{feedback}</Alert></div> : null}

      <div className="grid gap-4">
        {filteredTechnicians.map((technician) => {
          const action = recommendedAction(technician.status);
          return (
            <Card className="overflow-hidden" key={technician.id}>
              <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar className="size-11" name={technician.displayName} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><p className="truncate font-semibold">{technician.displayName}</p><StatusBadge status={technician.status} /></div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">{technician.headline}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{technician.city} · {technician.metrics.completedJobs} servicios · {technician.metrics.rating > 0 ? `${technician.metrics.rating.toFixed(1)} de rating` : "Sin evaluaciones"}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {action ? (
                    <Button onClick={() => { void applyQuickAction(technician, action.next, action.label); }} size="sm" variant={action.next === "temporarily_suspended" ? "destructive" : "default"}>
                      {action.next === "verified" || action.next === "active" ? <CheckCircle2 aria-hidden="true" className="size-4" /> : <ShieldAlert aria-hidden="true" className="size-4" />}{action.label}
                    </Button>
                  ) : null}
                  <Link className={buttonVariants({ size: "sm", variant: "outline" })} href={`/admin/tecnicos/${technician.slug}`}>Gestionar <ArrowUpRight aria-hidden="true" className="size-4" /></Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredTechnicians.length === 0 ? <EmptyState description="Prueba una búsqueda distinta o vuelve a ver todos los perfiles." icon={SearchX} title="No encontramos técnicos con esos filtros" /> : null}
    </div>
  );
}
