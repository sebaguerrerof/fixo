export const JOB_STATUSES = [
  "awarded",
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
  awarded: [],
  scheduled: ["technician_en_route", "cancelled", "disputed"],
  technician_en_route: ["arrived", "cancelled", "disputed"],
  arrived: ["in_progress", "cancelled", "disputed"],
  in_progress: ["completed", "disputed"],
  completed: [],
  cancelled: [],
  disputed: [],
};

export function canTransitionJob(current: JobStatus, next: JobStatus): boolean {
  return JOB_TRANSITIONS[current].includes(next);
}
