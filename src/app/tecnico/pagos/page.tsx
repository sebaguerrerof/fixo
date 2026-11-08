import { TechnicianDashboardShell } from "@/components/technicians/technician-dashboard-shell";
import { EmptyState } from "@/components/shared/empty-state";

export default function TechnicianPaymentsPage() {
  return <TechnicianDashboardShell activeHref="/tecnico/pagos"><h1 className="mb-7 text-3xl font-bold">Pagos e ingresos</h1><EmptyState title="Los pagos aún no están habilitados" description="Fixo no procesa cobros ni liquidaciones por ahora. Aquí aparecerán los movimientos cuando el servicio esté disponible." /></TechnicianDashboardShell>;
}
