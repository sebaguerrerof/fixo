import type { ServiceRequestStatus } from "@/domain/enums/service-request-status";
import type { TechnicianStatus } from "@/domain/enums/technician-status";
import { Badge, type BadgeProps } from "@/components/ui/badge";

type DisplayStatus = TechnicianStatus | ServiceRequestStatus;

const labels: Record<DisplayStatus, string> = {
  draft: "Borrador",
  pending_verification: "Pendiente de verificación",
  needs_information: "Requiere antecedentes",
  verified: "Verificado",
  active: "Activo",
  temporarily_suspended: "Suspendido temporalmente",
  suspended: "Suspendido",
  banned: "Bloqueado",
  rejected: "Rechazado",
  submitted: "Enviada",
  matching: "Buscando técnicos",
  receiving_quotes: "Recibiendo cotizaciones",
  technician_selected: "Técnico seleccionado",
  awaiting_payment: "Pendiente de pago",
  scheduled: "Agendada",
  in_progress: "En progreso",
  completed: "Completada",
  cancelled: "Cancelada",
  expired: "Expirada",
  disputed: "En revisión",
};

export function technicianStatusLabel(status: TechnicianStatus): string {
  return labels[status];
}

function variantFor(status: DisplayStatus): BadgeProps["variant"] {
  if (["active", "verified", "completed"].includes(status)) return "success";
  if (["temporarily_suspended", "suspended", "banned", "cancelled", "rejected"].includes(status)) return "danger";
  if (["pending_verification", "needs_information", "awaiting_payment"].includes(status)) return "warning";
  return "info";
}

export function StatusBadge({ status }: { readonly status: DisplayStatus }) {
  return <Badge variant={variantFor(status)}>{labels[status]}</Badge>;
}
