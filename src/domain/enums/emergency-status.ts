export const EMERGENCY_STATUSES = [
  "created",
  "matching",
  "broadcasting",
  "accepted",
  "technician_en_route",
  "arrived",
  "in_progress",
  "completed",
  "cancelled",
  "expired",
  "disputed",
] as const;

export type EmergencyStatus = (typeof EMERGENCY_STATUSES)[number];

const EMERGENCY_TRANSITIONS: Record<EmergencyStatus, readonly EmergencyStatus[]> = {
  created: ["matching", "cancelled"],
  matching: ["broadcasting", "cancelled", "expired"],
  broadcasting: ["accepted", "cancelled", "expired"],
  // accepted puede cancelarse: el cliente o el técnico todavía pueden desistir antes de que el técnico esté en camino.
  accepted: ["technician_en_route", "cancelled", "disputed"],
  technician_en_route: ["arrived", "cancelled", "disputed"],
  arrived: ["in_progress", "cancelled", "disputed"],
  in_progress: ["completed", "disputed"],
  completed: [],
  cancelled: [],
  expired: [],
  disputed: [],
};

export function canTransitionEmergency(current: EmergencyStatus, next: EmergencyStatus): boolean {
  return EMERGENCY_TRANSITIONS[current].includes(next);
}

export function availableEmergencyTransitions(status: EmergencyStatus): readonly EmergencyStatus[] {
  return EMERGENCY_TRANSITIONS[status];
}

export function isTerminalEmergencyStatus(status: EmergencyStatus): boolean {
  return EMERGENCY_TRANSITIONS[status].length === 0;
}
