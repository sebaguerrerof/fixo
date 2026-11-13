import type { AcceptedQuoteSnapshot } from "@/domain/entities/quote";
import type { JobStatus } from "@/domain/enums/job-status";
import type { JobPaymentState } from "@/domain/entities/job-payment";

/**
 * Contrato de trabajo creado cuando se acepta una cotización o se asigna un
 * técnico a una urgencia. Reutiliza `JobStatus` (ya modelado en el dominio)
 * para el ciclo de vida del trabajo en terreno.
 */
export interface Job {
  readonly revision?: number;
  readonly confirmedScheduleId?: string | null;
  readonly startedAt?: string | null;
  readonly completionReportedAt?: string | null;
  readonly customerConfirmedAt?: string | null;
  readonly paymentState?: JobPaymentState;
  readonly id: string;
  readonly serviceRequestId: string;
  readonly quoteId: string | null;
  readonly emergencyId: string | null;
  readonly customerId: string;
  readonly technicianId: string;
  readonly status: JobStatus;
  readonly snapshot: AcceptedQuoteSnapshot | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
