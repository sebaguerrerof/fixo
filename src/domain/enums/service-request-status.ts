export const SERVICE_REQUEST_STATUSES = [
  "draft",
  "submitted",
  "matching",
  "receiving_quotes",
  "technician_selected",
  "awaiting_payment",
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
  "expired",
  "disputed",
] as const;

export type ServiceRequestStatus = (typeof SERVICE_REQUEST_STATUSES)[number];

const SERVICE_REQUEST_TRANSITIONS: Record<ServiceRequestStatus, readonly ServiceRequestStatus[]> = {
  draft: ["submitted", "cancelled"],
  submitted: ["matching", "cancelled", "expired"],
  matching: ["receiving_quotes", "cancelled", "expired"],
  receiving_quotes: ["technician_selected", "cancelled", "expired"],
  technician_selected: ["awaiting_payment", "cancelled"],
  awaiting_payment: ["scheduled", "cancelled", "disputed"],
  scheduled: ["in_progress", "cancelled", "disputed"],
  in_progress: ["completed", "disputed"],
  completed: [],
  cancelled: [],
  expired: [],
  disputed: [],
};

export function canTransitionServiceRequest(
  current: ServiceRequestStatus,
  next: ServiceRequestStatus,
): boolean {
  return SERVICE_REQUEST_TRANSITIONS[current].includes(next);
}
