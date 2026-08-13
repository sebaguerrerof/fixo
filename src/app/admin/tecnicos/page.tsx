import { UsersRound } from "lucide-react";

import { AdminDashboardShell } from "@/components/admin/admin-dashboard-shell";
import { TechnicianManagementPanel } from "@/features/admin/technician-management-panel";
import { AdminDashboardService } from "@/services/admin/admin-dashboard-service";

export default async function AdminTechniciansPage() {
  const { technicians } = await new AdminDashboardService().getOverview();
  return <AdminDashboardShell activeHref="/admin/tecnicos"><div><p className="text-sm font-semibold text-primary">Directorio operativo</p><h1 className="mt-1 flex items-center gap-3 text-3xl font-bold tracking-tight"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><UsersRound className="size-5" /></span>Gestionar técnicos</h1><p className="mt-3 max-w-2xl leading-7 text-muted-foreground">Revisa perfiles, verifica antecedentes y aplica estados administrativos con historial trazable.</p></div><div className="mt-7"><TechnicianManagementPanel initialTechnicians={technicians} /></div></AdminDashboardShell>;
}
