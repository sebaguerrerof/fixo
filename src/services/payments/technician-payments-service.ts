import type { JobListItem } from "@/domain/entities/job-operations";
import type { JobPaymentsLoad } from "./payment-read-service";

export const TECHNICIAN_PAYMENTS_PAGE_SIZE = 20; // same as the `job_list` RPC
export const MAX_PAYMENTS_PAGE = 10000;

/** Same clamping as the jobs list: anything not a positive integer falls back to page 1. */
export function parsePaymentsPage(value: string | undefined): number {
  return Math.min(MAX_PAYMENTS_PAGE, Math.max(1, Number.parseInt(value ?? "1", 10) || 1));
}

export interface TechnicianPaymentRow { readonly item: JobListItem; readonly payments: JobPaymentsLoad }
/** `unavailable` (jobs could not be listed) is deliberately distinct from `ok` with no rows: an outage is never shown as "no payments". */
export type TechnicianPaymentsPage =
  | { readonly status: "ok"; readonly page: number; readonly total: number; readonly hasPrevious: boolean; readonly hasNext: boolean; readonly rows: readonly TechnicianPaymentRow[] }
  | { readonly status: "unavailable"; readonly page: number };

export interface TechnicianPaymentsDeps {
  readonly listJobs: (page: number) => Promise<{ readonly items: readonly JobListItem[]; readonly total: number }>;
  readonly loadPayments: (jobId: string) => Promise<JobPaymentsLoad>;
}

/** Bounded: one page of jobs (<= 20) and one read per job, all through the caller's own JWT. */
export async function loadTechnicianPayments(pageParam: string | undefined, deps: TechnicianPaymentsDeps): Promise<TechnicianPaymentsPage> {
  const page = parsePaymentsPage(pageParam);
  try {
    const { items, total } = await deps.listJobs(page);
    const rows = await Promise.all(items.map(async (item) => ({ item, payments: await deps.loadPayments(item.job.id) })));
    return { status: "ok", page, total, hasPrevious: page > 1, hasNext: page * TECHNICIAN_PAYMENTS_PAGE_SIZE < total, rows };
  } catch { return { status: "unavailable", page }; }
}
