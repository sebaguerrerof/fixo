import { TechnicianDashboardShell } from "@/components/technicians/technician-dashboard-shell";
import { EmptyState } from "@/components/shared/empty-state";

export default function TechnicianSchedulePage() {
  return <TechnicianDashboardShell activeHref="/tecnico/agenda"><h1 className="mb-7 text-3xl font-bold">Agenda</h1><EmptyState title="Agenda aún no disponible" description="La gestión de horarios se habilitará cuando puedas programar trabajos desde Fixo." /></TechnicianDashboardShell>;
}
