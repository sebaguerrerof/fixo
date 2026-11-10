export const JOB_STATUSES = [
  "awarded",
  "coordination_pending",
  "date_proposed",
  "ready",
  "completion_reported",
  "scheduled",
  "technician_en_route",
  "arrived",
  "in_progress",
  "completed",
  "cancelled",
  "disputed",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

const JOB_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  awarded: ["date_proposed"],
  coordination_pending: ["date_proposed"],
  date_proposed: ["scheduled", "coordination_pending", "date_proposed"],
  ready: ["in_progress", "date_proposed"],
  completion_reported: ["completed"],
  scheduled: ["ready", "date_proposed", "technician_en_route", "cancelled", "disputed"],
  technician_en_route: ["arrived", "cancelled", "disputed"],
  arrived: ["in_progress", "cancelled", "disputed"],
  in_progress: ["completion_reported", "completed", "disputed"],
  completed: [],
  cancelled: [],
  disputed: [],
};

export function canTransitionJob(current: JobStatus, next: JobStatus): boolean {
  return JOB_TRANSITIONS[current].includes(next);
}
