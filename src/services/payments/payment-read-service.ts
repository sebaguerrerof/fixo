import type { JobPaymentsView } from "@/domain/entities/job-payment";
import { getPaymentRepository } from "@/repositories/repository-factory";

export type JobPaymentsLoad = { readonly status: "ok"; readonly view: JobPaymentsView } | { readonly status: "unavailable" };

/** Reads through the caller's own JWT (RLS/DB authorization). Demo mode, missing access or any failure render as "unavailable", never as zero debt. */
export async function loadJobPayments(jobId: string): Promise<JobPaymentsLoad> {
  try { const view = await getPaymentRepository().getJobPayments(jobId); return view ? { status: "ok", view } : { status: "unavailable" }; }
  catch { return { status: "unavailable" }; }
}
