import { AdminDashboardShell } from "@/components/admin/admin-dashboard-shell";
import { EmptyState } from "@/components/shared/empty-state";

export default function AdminSettingsPage() {
  return <AdminDashboardShell activeHref="/admin/configuracion"><h1 className="mb-7 text-3xl font-bold">Configuración operativa</h1><EmptyState title="Configuración comercial pendiente" description="Las comisiones, los cobros y las notificaciones no están habilitados. Sus condiciones se definirán antes de activar cada servicio." /></AdminDashboardShell>;
}
