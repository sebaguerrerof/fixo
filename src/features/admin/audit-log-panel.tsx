"use client";

import { History } from "lucide-react";
import { useEffect, useState } from "react";

import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import type { AdminAuditEntry } from "@/domain/entities/audit-log";
import { LocalAdminManagementStore } from "@/services/admin/local-admin-management-store";

export function AuditLogPanel() {
  const [entries, setEntries] = useState<AdminAuditEntry[]>([]);

  useEffect(() => setEntries(new LocalAdminManagementStore().readAuditEntries()), []);

  if (!entries.length) {
    return <Card><CardContent className="flex flex-col items-center py-14 text-center"><span className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-primary"><History className="size-6" /></span><h2 className="mt-4 font-bold">Aún no hay acciones registradas</h2><p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Cuando apruebes, suspendas, reactives o rechaces un técnico, su acción aparecerá aquí con el motivo y responsable.</p></CardContent></Card>;
  }

  return <Card><CardContent className="divide-y"><div className="grid min-w-[620px] grid-cols-[1.2fr_1fr_1.2fr_1fr] gap-4 pb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><span>Técnico</span><span>Cambio</span><span>Motivo</span><span>Fecha</span></div>{entries.map((entry) => <div key={entry.id} className="grid min-w-[620px] grid-cols-[1.2fr_1fr_1.2fr_1fr] gap-4 py-4 text-sm"><span className="font-semibold">{entry.technicianName}</span><span className="flex flex-wrap items-center gap-1"><StatusBadge status={entry.previousStatus} />→<StatusBadge status={entry.nextStatus} /></span><span className="text-muted-foreground">{entry.reason}</span><span className="text-muted-foreground">{new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.createdAt))}</span></div>)}</CardContent></Card>;
}
