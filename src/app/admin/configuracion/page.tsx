import { AdminDashboardShell } from "@/components/admin/admin-dashboard-shell";
import { PaymentsAdminOverview } from "@/components/payments/payments-admin-overview";
import { requireServerRole } from "@/services/auth/server-authentication-service";

export default async function AdminSettingsPage() {
  const user = await requireServerRole(["moderator", "superadmin"]);
  return <AdminDashboardShell activeHref="/admin/configuracion"><h1 className="mb-3 text-3xl font-bold">Configuración operativa</h1>
    <p className="mb-7 text-muted-foreground">Entorno de prueba (Sandbox): no se realizan cobros reales. {user.role === "superadmin" ? "Puedes editar la comisión y solicitar verificaciones." : "Vista de sólo lectura."}</p>
    <PaymentsAdminOverview superadmin={user.role === "superadmin"} /></AdminDashboardShell>;
}
