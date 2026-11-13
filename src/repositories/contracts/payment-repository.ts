import type { JobPaymentsView } from "@/domain/entities/job-payment";
import type { PaymentAdminOverview } from "@/domain/entities/payment-admin";

/** Result of the authorized, consented preparation of an obligation (DB computed; nothing is taken from the browser). */
export interface PreparedPayment {
  readonly orderId: string; readonly attemptId: string; readonly commerceOrder: string;
  readonly attemptState: string;
  readonly professionalAmountClp: number; readonly platformFeeClp: number; readonly totalClp: number; readonly policyVersion: number;
}
export interface PricingPolicy { readonly version: number; readonly feeBasisPoints: number }
export interface PrepareInput { readonly jobId: string; readonly extraChargeId: string | null; readonly expectedPolicyVersion: number; readonly consent: boolean; readonly idempotencyKey: string }
export interface ReservedAttempt { readonly attemptId: string; readonly orderId: string; readonly commerceOrder: string; readonly amountClp: number; readonly customerId: string }

/** User-JWT repository: subject to RLS and DB authorization. */
export interface PaymentRepository {
  getPolicy(): Promise<PricingPolicy>;
  prepare(input: PrepareInput): Promise<PreparedPayment>;
  /** Role-aware read model (RLS/DB authorization); null when the job is not readable by the caller. */
  getJobPayments(jobId: string): Promise<JobPaymentsView | null>;
  /** Customer-only. Accepting freezes the obligation with the displayed policy version (DB rejects a stale version). */
  respondExtra(input: RespondExtraInput): Promise<void>;
  /** Assigned, currently enabled professional only; idempotent per (professional, operationId). */
  proposeExtra(input: ProposeExtraInput): Promise<string>;
  /** Administrators (moderator: read-only). */
  getAdminOverview(): Promise<PaymentAdminOverview>;
  /** Superadmin only; versioned (DB rejects a stale expected version) and reasoned. Applies to NEW orders only. */
  setPolicy(input: SetPolicyInput): Promise<PricingPolicy>;
  /** Superadmin only. Schedules a provider re-check; it can never impose "paid". */
  requestReconciliation(attemptId: string): Promise<void>;
}
export interface SetPolicyInput { readonly expectedVersion: number; readonly basisPoints: number; readonly reason: string }
export interface ProposeExtraInput { readonly jobId: string; readonly operationId: string; readonly concept: string; readonly amountClp: number }
export interface RespondExtraInput { readonly extraChargeId: string; readonly decision: "accepted" | "rejected"; readonly expectedPolicyVersion: number | null; readonly reason: string | null }

/** Privileged server-only repository (service role). Used by payment creation and, later, the worker and callbacks. */
export interface PaymentProcessingRepository {
  /** Revalidates the obligation under locks and moves the attempt to `creating` BEFORE any network call. */
  beginCreate(attemptId: string): Promise<ReservedAttempt>;
  setCheckout(attemptId: string, flowOrder: number, ciphertext: Buffer, keyId: string): Promise<void>;
  markAmbiguous(attemptId: string, code: string): Promise<void>;
  markFailed(attemptId: string, code: string): Promise<void>;
  /** Encrypted checkout of a still-payable pending attempt, only for its owning customer; PaymentConflictError otherwise. */
  getCheckout(attemptId: string, customerId: string): Promise<{ readonly ciphertext: Buffer; readonly keyId: string }>;
}

/** Durable reception of provider notifications (service role). The token is stored hashed (dedup) and encrypted (to query the provider later). */
export interface PaymentInboxRepository {
  receive(tokenSha256: string, ciphertext: Buffer, keyId: string, signal?: AbortSignal): Promise<string>;
}

export interface ClaimedInbox { readonly id: string; readonly tokenCiphertext: Buffer; readonly tokenSha256: string; readonly keyId: string; readonly generation: number; readonly leaseToken: string; readonly attempt: number }
export interface ClaimedAttempt { readonly attemptId: string; readonly commerceOrder: string; readonly flowOrder: number | null; readonly leaseToken: string; readonly checkCount: number; readonly state: string }
export interface ObservationInput {
  readonly attemptId: string | null; readonly eventKey: string; readonly flowOrder: number | null; readonly commerceOrder: string | null;
  readonly statusCode: number | null; readonly amountClp: number | null; readonly currency: string | null; readonly feeClp: number | null;
}
export interface ObservationResult { readonly result: string; readonly validation: string | null }
export type InboxFinish = { readonly outcome: "done"; readonly observedGeneration: number } | { readonly outcome: "retry" } | { readonly outcome: "quarantine"; readonly reason: string };

/** Privileged worker repository (service role): leases, fencing and ONE atomic DB application per verified observation. No network inside the DB. */
export interface PaymentWorkerRepository {
  claimInbox(): Promise<ClaimedInbox | null>;
  finishInbox(inboxId: string, leaseToken: string, finish: InboxFinish): Promise<void>;
  claimDueAttempt(): Promise<ClaimedAttempt | null>;
  releaseAttempt(attemptId: string, leaseToken: string, delaySeconds: number, code: string | null): Promise<void>;
  lookupAttempt(commerceOrder: string | null, flowOrder: number | null): Promise<string | null>;
  applyObservation(input: ObservationInput): Promise<ObservationResult>;
  cleanupRateLimits(): Promise<number>;
  /** Purges encrypted token material of resolved attempts/inbox rows older than `retentionDays`; returns the number of rows purged. */
  purgeSensitive(retentionDays: number): Promise<number>;
}

/** Sanitized, user-presentable repository failures. */
export class PaymentConflictError extends Error { constructor(message: string) { super(message); this.name = "PaymentConflictError"; } }
export class PaymentForbiddenError extends Error { constructor(message: string) { super(message); this.name = "PaymentForbiddenError"; } }

export type RateLimitScope = "checkout_user" | "callback_ip";
export interface RateLimitDecision { readonly allowed: boolean; readonly retryAfterSeconds: number }
/** Persistent shared limiter (service role). A denied hit still counts. Any failure is the caller's to treat as fail-closed. */
export interface PaymentRateLimiter {
  hit(scope: RateLimitScope, subject: string, maxHits: number, windowSeconds: number, signal?: AbortSignal): Promise<RateLimitDecision>;
}
