import type { PaymentStatus } from "@/domain/enums/payment-status";
/**
 * Sprint 05: amountClp is the customer total T = Q + F. The order id is the internal reference;
 * each external attempt carries its own commerceOrder (unique per attempt, sent to Flow).
 */
export interface PaymentOrder {
  readonly id: string; readonly jobId: string; readonly quoteId: string; readonly customerId: string;
  readonly snapshotSha256: string; readonly amountClp: number; readonly currency: "CLP";
  readonly professionalAmountClp: number; readonly platformFeeClp: number; readonly feeBasisPoints: number; readonly policyVersion: number;
  readonly status: PaymentStatus; readonly provider: "flow"; readonly environment: "sandbox" | "production";
  readonly createdAt: string;
}
export interface PaymentAttempt {
  readonly id: string; readonly orderId: string; readonly idempotencyKey: string; readonly commerceOrder: string; readonly providerPaymentId: string | null;
  readonly state: "prepared" | "creating" | "pending" | "reconciliation_required" | "failed"; readonly errorCode: string | null; readonly createdAt: string;
}
export interface PaymentEvent {
  readonly id: string; readonly orderId: string; readonly providerPaymentId: string; readonly providerEventKey: string;
  readonly source: "verified_provider_query"; readonly observedStatus: PaymentStatus; readonly amountClp: number; readonly currency: "CLP"; readonly observedAt: string;
}
export interface RefundRequest {
  readonly id: string; readonly orderId: string; readonly amountClp: number; readonly reason: string; readonly requestedBy: string;
  readonly state: "pending_policy" | "pending_approval" | "approved" | "submitted" | "confirmed" | "rejected"; readonly providerRefundId: string | null;
}
export interface ReconciliationResult {
  readonly orderId: string; readonly providerPaymentId: string | null; readonly result: "matched" | "pending" | "mismatch" | "unavailable";
  readonly verifiedEvent: PaymentEvent | null; readonly checkedAt: string; readonly errorCode: string | null;
}
