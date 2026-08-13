import { History } from "lucide-react";

import { AdminDashboardShell } from "@/components/admin/admin-dashboard-shell";
import { AuditLogPanel } from "@/features/admin/audit-log-panel";

export default function AdminAuditLogPage() {
  return <AdminDashboardShell activeHref="/admin/audit-log"><div><p className="text-sm font-semibold text-primary">Trazabilidad</p><h1 className="mt-1 flex items-center gap-3 text-3xl font-bold tracking-tight"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><History className="size-5" /></span>Audit log</h1><p className="mt-3 max-w-2xl leading-7 text-muted-foreground">Consulta cambios administrativos por perfil, con el estado anterior, el nuevo estado y el motivo registrado.</p></div><div className="mt-7 overflow-x-auto"><AuditLogPanel /></div></AdminDashboardShell>;
}
