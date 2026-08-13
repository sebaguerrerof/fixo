export const TECHNICIAN_STATUSES = [
  "draft",
  "pending_verification",
  "needs_information",
  "verified",
  "active",
  "temporarily_suspended",
  "suspended",
  "banned",
  "rejected",
] as const;

export type TechnicianStatus = (typeof TECHNICIAN_STATUSES)[number];

export const PUBLIC_TECHNICIAN_STATUSES = ["verified", "active"] as const;

const TECHNICIAN_STATUS_TRANSITIONS: Record<TechnicianStatus, readonly TechnicianStatus[]> = {
  draft: ["pending_verification", "rejected"],
  pending_verification: ["needs_information", "verified", "rejected"],
  needs_information: ["pending_verification", "rejected"],
  verified: ["active", "temporarily_suspended", "banned"],
  active: ["temporarily_suspended", "suspended", "banned"],
  temporarily_suspended: ["active", "suspended", "banned"],
  suspended: ["active", "banned"],
  banned: [],
  rejected: ["pending_verification"],
};

export function canReceiveWork(status: TechnicianStatus): boolean {
  return status === "active";
}

export function canTransitionTechnician(current: TechnicianStatus, next: TechnicianStatus): boolean {
  return TECHNICIAN_STATUS_TRANSITIONS[current].includes(next);
}

export function availableTechnicianTransitions(status: TechnicianStatus): readonly TechnicianStatus[] {
  return TECHNICIAN_STATUS_TRANSITIONS[status];
}
