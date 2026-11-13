import { AdminDashboardShell } from "@/components/admin/admin-dashboard-shell";
import { EmptyState } from "@/components/shared/empty-state";

export default function AdminReportsPage() {
  return <AdminDashboardShell activeHref="/admin/reportes"><h1 className="mb-7 text-3xl font-bold">Reportes y reclamos</h1><EmptyState title="Gestión de reclamos aún no disponible" description="Esta sección todavía no recibe ni registra incidentes. El canal operativo de soporte debe definirse antes del lanzamiento." /></AdminDashboardShell>;
}
