import type { ServiceRequestStatus } from "@/domain/enums/service-request-status";
import type { TechnicianStatus } from "@/domain/enums/technician-status";
import type { QuoteStatus } from "@/domain/enums/quote-status";
import type { JobStatus } from "@/domain/enums/job-status";
import type { EmergencyStatus } from "@/domain/enums/emergency-status";
import { Badge, type BadgeProps } from "@/components/ui/badge";

type DisplayStatus = TechnicianStatus | ServiceRequestStatus | QuoteStatus | JobStatus | EmergencyStatus;

const labels: Record<DisplayStatus, string> = {
  awarded: "Adjudicado · ejecución pendiente",
  draft: "Borrador",
  pending_verification: "Pendiente de verificación",
  needs_information: "Requiere antecedentes",
  verified: "Verificado",
  active: "Activo",
  temporarily_suspended: "Suspendido temporalmente",
  suspended: "Suspendido",
  banned: "Bloqueado",
  rejected: "Rechazada",
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
  accepted: "Aceptada",
  withdrawn: "Retirada",
  created: "Creada",
  broadcasting: "Buscando técnico",
  technician_en_route: "Técnico en camino",
  arrived: "Técnico en el lugar",
};

export function technicianStatusLabel(status: TechnicianStatus): string {
  return labels[status];
}

function variantFor(status: DisplayStatus): BadgeProps["variant"] {
  if (["active", "verified", "completed", "accepted"].includes(status)) return "success";
  if (["temporarily_suspended", "suspended", "banned", "cancelled", "rejected", "withdrawn", "disputed"].includes(status)) return "danger";
  if (["pending_verification", "needs_information", "awaiting_payment", "expired"].includes(status)) return "warning";
  return "info";
}

export function StatusBadge({ status }: { readonly status: DisplayStatus }) {
  return <Badge variant={variantFor(status)}>{labels[status]}</Badge>;
}
