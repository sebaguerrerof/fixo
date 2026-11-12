/** Estado del pago inicial proyectado en `jobs.payment_state` (Sprint 05). */
export type JobPaymentState = "not_enabled" | "payment_pending" | "paid" | "payment_failed" | "payment_review";
const states: readonly JobPaymentState[] = ["not_enabled", "payment_pending", "paid", "payment_failed", "payment_review"];
/** Unknown values fail closed to `not_enabled`; only the DB projection can set the others. */
export function parseJobPaymentState(value: unknown): JobPaymentState { return states.find((s) => s === value) ?? "not_enabled"; }
export type PaymentOrderStatus = "awaiting_payment" | "paid" | string;
export type ExtraChargeState = "proposed" | "accepted" | "rejected" | string;

/**
 * Lectura por rol de `public.job_payments`. Para el técnico la DB entrega `platformFeeClp`/`totalClp` nulos:
 * sólo conoce el importe asignado Q, nunca lo presenta como transferencia efectuada.
 */
export interface JobPaymentOrderView {
  readonly id: string; readonly origin: "initial" | "extra"; readonly extraChargeId: string | null; readonly status: PaymentOrderStatus; readonly review: boolean;
  /** Policy version frozen into this order; consent must be given against exactly this breakdown. */
  readonly policyVersion: number;
  readonly professionalAmountClp: number; readonly platformFeeClp: number | null; readonly totalClp: number | null;
  readonly paidAt: string | null; readonly createdAt: string; readonly latestAttemptState: string | null;
  /** Sólo cliente y administración. */
  readonly latestAttemptId: string | null;
  /** Sólo administración. */
  readonly flowCostClp: number | null; readonly reviewReason: string | null; readonly marginStatus: "pending_reconciliation" | "confirmed" | null; readonly platformMarginClp: number | null;
  /** Cálculo de prueba; no es una transferencia ni un saldo retirable. */
  readonly simulatedSettlementClp: number | null;
}
export interface JobExtraChargeView { readonly id: string; readonly concept: string; readonly amountClp: number; readonly state: ExtraChargeState; readonly createdAt: string }
export interface JobPaymentsView {
  readonly jobId: string; readonly paymentState: JobPaymentState; readonly environment: "sandbox";
  readonly policy: { readonly version: number; readonly feeBasisPoints: number } | null;
  readonly unpaidExtras: boolean; readonly orders: readonly JobPaymentOrderView[]; readonly extras: readonly JobExtraChargeView[];
}
