import { getSupabaseServerClient } from "@/integrations/supabase/server-client";
import { PaymentConflictError, PaymentForbiddenError, type ClaimedAttempt, type ClaimedInbox, type InboxFinish, type ObservationInput, type ObservationResult, type PaymentWorkerRepository, type PaymentInboxRepository, type PaymentProcessingRepository, type PaymentRateLimiter, type RateLimitDecision, type RateLimitScope, type PaymentRepository, type PrepareInput, type PreparedPayment, type PricingPolicy, type ReservedAttempt } from "@/repositories/contracts/payment-repository";
import { parseJobPaymentState, type JobPaymentsView } from "@/domain/entities/job-payment";
import type { PaymentAdminOverview, FeePolicyVersion } from "@/domain/entities/payment-admin";
import type { ProposeExtraInput, RespondExtraInput, SetPolicyInput } from "@/repositories/contracts/payment-repository";
import { asNumber, asRecord, asRecords, asString } from "./supabase-helpers";

type RpcError = { readonly code?: string; readonly message: string } | null;
/** Maps DB error codes to sanitized errors; PT409/22023 messages are authored by our migration and safe to show. */
function fail(error: RpcError, fallback: string): never {
  if (error?.code === "PT409" || error?.code === "22023") throw new PaymentConflictError(error.message);
  if (error?.code === "42501") throw new PaymentForbiddenError("Esta operación no está habilitada para tu cuenta.");
  throw new Error(fallback);
}

export class SupabasePaymentRepository implements PaymentRepository {
  async getPolicy(): Promise<PricingPolicy> {
    const client = await getSupabaseServerClient(); const { data, error } = await client.rpc("payment_policy_current");
    if (error) fail(error, "No pudimos cargar la política de comisión"); const r = asRecord(data);
    return { version: asNumber(r.version), feeBasisPoints: asNumber(r.fee_basis_points) };
  }
  async prepare(input: PrepareInput): Promise<PreparedPayment> {
    const client = await getSupabaseServerClient();
    const { data, error } = await client.rpc("payment_prepare", { target_job: input.jobId, target_extra: input.extraChargeId, expected_policy_version: input.expectedPolicyVersion, consent: input.consent, idempotency_key: input.idempotencyKey });
    if (error) fail(error, "No pudimos preparar el pago"); const r = asRecord(data);
    return { orderId: asString(r.order_id), attemptId: asString(r.attempt_id), commerceOrder: asString(r.commerce_order), attemptState: asString(r.attempt_state),
      professionalAmountClp: asNumber(r.professional_amount_clp), platformFeeClp: asNumber(r.platform_fee_clp), totalClp: asNumber(r.total_clp), policyVersion: asNumber(r.policy_version) };
  }
  async getJobPayments(jobId: string): Promise<JobPaymentsView | null> {
    const client = await getSupabaseServerClient(); const { data, error } = await client.rpc("job_payments", { target_job: jobId });
    if (error) fail(error, "No pudimos cargar los pagos del trabajo"); if (data === null) return null;
    return mapJobPayments(data);
  }
  async respondExtra(input: RespondExtraInput): Promise<void> {
    const client = await getSupabaseServerClient();
    const { error } = await client.rpc("job_extra_respond", { target_extra: input.extraChargeId, decision: input.decision, expected_policy_version: input.expectedPolicyVersion, reason_text: input.reason });
    if (error) fail(error, "No pudimos registrar tu respuesta");
  }
  async proposeExtra(input: ProposeExtraInput): Promise<string> {
    const client = await getSupabaseServerClient();
    const { data, error } = await client.rpc("job_extra_propose", { target_job: input.jobId, operation_id: input.operationId, concept_text: input.concept, amount: input.amountClp });
    if (error) fail(error, "No pudimos registrar el adicional"); return asString(asRecord(data).id);
  }
  async getAdminOverview(): Promise<PaymentAdminOverview> {
    const client = await getSupabaseServerClient(); const { data, error } = await client.rpc("payment_admin_overview");
    if (error) fail(error, "No pudimos cargar el resumen de pagos"); return mapAdminOverview(data);
  }
  async setPolicy(input: SetPolicyInput): Promise<PricingPolicy> {
    const client = await getSupabaseServerClient();
    const { data, error } = await client.rpc("payment_policy_set", { expected_version: input.expectedVersion, basis_points: input.basisPoints, change_reason: input.reason });
    if (error) fail(error, "No pudimos actualizar el porcentaje"); const r = asRecord(data);
    return { version: asNumber(r.version), feeBasisPoints: asNumber(r.fee_basis_points) };
  }
  async requestReconciliation(attemptId: string): Promise<void> {
    const client = await getSupabaseServerClient(); const { error } = await client.rpc("payment_request_reconciliation", { target_attempt: attemptId });
    if (error) fail(error, "No pudimos programar la verificación");
  }
}

const policyVersion = (p: Record<string, unknown>): FeePolicyVersion => ({ version: asNumber(p.version), feeBasisPoints: asNumber(p.fee_basis_points), reason: asString(p.reason), createdAt: asString(p.created_at), authorName: nullableString(p.author_name) });
/** Pure mapper of `public.payment_admin_overview`. */
export function mapAdminOverview(value: unknown): PaymentAdminOverview {
  const r = asRecord(value), policy = asRecord(r.policy);
  return {
    policy: typeof policy.version === "number" ? policyVersion(policy) : null,
    history: asRecords(r.history).map(policyVersion),
    pending: asRecords(r.pending).map((a) => ({ attemptId: asString(a.attempt_id), orderId: asString(a.order_id), jobId: asString(a.job_id), state: asString(a.state), costPending: a.cost_pending === true, exhausted: a.exhausted === true,
      lastCheckedAt: nullableString(a.last_checked_at), nextCheckAt: nullableString(a.next_check_at), checkCount: asNumber(a.check_count), errorCode: nullableString(a.error_code) })),
    reviews: asRecords(r.reviews).map((o) => ({ orderId: asString(o.order_id), jobId: asString(o.job_id), reason: asString(o.reason), status: asString(o.status), updatedAt: asString(o.updated_at) })),
    quarantinedInbox: asNumber(r.quarantined_inbox),
  };
}

const nullableNumber = (v: unknown): number | null => (typeof v === "number" ? v : typeof v === "string" && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null);
const nullableString = (v: unknown): string | null => (typeof v === "string" ? v : null);
/** Pure mapper of `public.job_payments`.  */
export function mapJobPayments(value: unknown): JobPaymentsView {
  const r = asRecord(value), policy = asRecord(r.policy);
  return {
    jobId: asString(r.job_id), paymentState: parseJobPaymentState(r.payment_state), environment: "sandbox",
    policy: typeof policy.version === "number" ? { version: policy.version, feeBasisPoints: asNumber(policy.fee_basis_points) } : null,
    unpaidExtras: r.unpaid_extras === true,
    orders: asRecords(r.orders).map((o) => ({
      id: asString(o.id), origin: o.origin === "extra" ? "extra" : "initial", extraChargeId: nullableString(o.extra_charge_id), status: asString(o.status), review: o.review === true,
      policyVersion: asNumber(o.policy_version), professionalAmountClp: asNumber(o.professional_amount_clp), platformFeeClp: nullableNumber(o.platform_fee_clp), totalClp: nullableNumber(o.total_clp),
      paidAt: nullableString(o.paid_at), createdAt: asString(o.created_at), latestAttemptState: nullableString(o.latest_attempt_state), latestAttemptId: nullableString(o.latest_attempt_id),
      flowCostClp: nullableNumber(o.flow_cost_clp), reviewReason: nullableString(o.review_reason),
      marginStatus: o.margin_status === "confirmed" || o.margin_status === "pending_reconciliation" ? o.margin_status : null,
      platformMarginClp: nullableNumber(o.platform_margin_clp), simulatedSettlementClp: nullableNumber(o.simulated_settlement_clp),
    })),
    extras: asRecords(r.extras).map((x) => ({ id: asString(x.id), concept: asString(x.concept), amountClp: asNumber(x.amount_clp), state: asString(x.state), createdAt: asString(x.created_at) })),
  };
}

/** Loaded lazily so the server-only privileged client is never pulled into modules that only need the factory. */
async function serviceClient() { return (await import("@/integrations/supabase/payments-service-client")).getPaymentsServiceClient(); }

/** PostgREST expects bytea as a hex string prefixed with backslash-x. */
const bytea = (b: Buffer) => "\\x" + b.toString("hex");

export class SupabasePaymentProcessingRepository implements PaymentProcessingRepository {
  async beginCreate(attemptId: string): Promise<ReservedAttempt> {
    const { data, error } = await (await serviceClient()).rpc("payment_attempt_begin_create", { target_attempt: attemptId });
    if (error) fail(error, "No pudimos reservar el intento de pago"); const r = asRecord(data);
    return { attemptId: asString(r.attempt_id), orderId: asString(r.order_id), commerceOrder: asString(r.commerce_order), amountClp: asNumber(r.amount_clp), customerId: asString(r.customer_id) };
  }
  async setCheckout(attemptId: string, flowOrder: number, ciphertext: Buffer, keyId: string): Promise<void> {
    const { error } = await (await serviceClient()).rpc("payment_attempt_set_checkout", { target_attempt: attemptId, flow_order_id: flowOrder, ciphertext: bytea(ciphertext), key_id: keyId });
    if (error) fail(error, "No pudimos guardar el checkout");
  }
  async markAmbiguous(attemptId: string, code: string): Promise<void> {
    const { error } = await (await serviceClient()).rpc("payment_attempt_mark_ambiguous", { target_attempt: attemptId, code });
    if (error) fail(error, "No pudimos marcar el intento para conciliación");
  }
  async markFailed(attemptId: string, code: string): Promise<void> {
    const { error } = await (await serviceClient()).rpc("payment_attempt_mark_failed", { target_attempt: attemptId, code });
    if (error) fail(error, "No pudimos cerrar el intento");
  }
  async getCheckout(attemptId: string, customerId: string): Promise<{ readonly ciphertext: Buffer; readonly keyId: string }> {
    const { data, error } = await (await serviceClient()).rpc("payment_attempt_checkout", { target_attempt: attemptId, expected_customer: customerId });
    if (error) fail(error, "No pudimos recuperar el checkout"); const r = asRecord(data);
    return { ciphertext: Buffer.from(asString(r.ciphertext), "hex"), keyId: asString(r.key_id) };
  }
}

export class SupabasePaymentInboxRepository implements PaymentInboxRepository {
  async receive(tokenSha256: string, ciphertext: Buffer, keyId: string, signal?: AbortSignal): Promise<string> {
    const call = (await serviceClient()).rpc("payment_inbox_receive", { token_hash: tokenSha256, ciphertext: bytea(ciphertext), key_id: keyId });
    const { data, error } = await (signal ? call.abortSignal(signal) : call);
    if (error || typeof data !== "string") return fail(error, "No pudimos registrar la notificación");
    return data;
  }
}

export class SupabasePaymentWorkerRepository implements PaymentWorkerRepository {
  async claimInbox(): Promise<ClaimedInbox | null> {
    const { data, error } = await (await serviceClient()).rpc("payment_inbox_claim");
    if (error) return fail(error, "No pudimos reclamar la bandeja"); if (data === null) return null; const r = asRecord(data);
    return { id: asString(r.id), tokenCiphertext: Buffer.from(asString(r.token_ciphertext), "base64"), tokenSha256: asString(r.token_sha256), keyId: asString(r.key_id), generation: asNumber(r.generation), leaseToken: asString(r.lease_token), attempt: asNumber(r.attempt) };
  }
  async finishInbox(inboxId: string, leaseToken: string, finish: InboxFinish): Promise<void> {
    const { error } = await (await serviceClient()).rpc("payment_inbox_finish", { inbox_id: inboxId, lease: leaseToken, outcome: finish.outcome,
      observed_generation: finish.outcome === "done" ? finish.observedGeneration : 0, reason: finish.outcome === "quarantine" ? finish.reason : null });
    if (error) fail(error, "No pudimos cerrar la notificación");
  }
  async claimDueAttempt(): Promise<ClaimedAttempt | null> {
    const { data, error } = await (await serviceClient()).rpc("payment_attempt_claim_due");
    if (error) return fail(error, "No pudimos reclamar un intento"); if (data === null) return null; const r = asRecord(data);
    return { attemptId: asString(r.attempt_id), commerceOrder: asString(r.commerce_order), flowOrder: r.flow_order === null || r.flow_order === undefined ? null : asNumber(r.flow_order), leaseToken: asString(r.lease_token), checkCount: asNumber(r.check_count), state: asString(r.state) };
  }
  async releaseAttempt(attemptId: string, leaseToken: string, delaySeconds: number, code: string | null): Promise<void> {
    const { error } = await (await serviceClient()).rpc("payment_attempt_release", { target_attempt: attemptId, lease: leaseToken, delay_seconds: delaySeconds, code });
    if (error) fail(error, "No pudimos liberar el intento");
  }
  async lookupAttempt(commerceOrder: string | null, flowOrder: number | null): Promise<string | null> {
    const { data, error } = await (await serviceClient()).rpc("payment_attempt_lookup", { by_commerce_order: commerceOrder, by_flow_order: flowOrder });
    if (error) return fail(error, "No pudimos resolver el intento"); return typeof data === "string" ? data : null;
  }
  async applyObservation(i: ObservationInput): Promise<ObservationResult> {
    const { data, error } = await (await serviceClient()).rpc("payment_apply_observation", { target_attempt: i.attemptId, event_key: i.eventKey, observed_flow_order: i.flowOrder,
      observed_commerce_order: i.commerceOrder, observed_status: i.statusCode, observed_amount: i.amountClp, observed_currency: i.currency, observed_fee: i.feeClp, provider_time: null }); // Flow supplies no validated timestamp: never attribute local processing time to the provider (observed_at records reception)
    if (error) return fail(error, "No pudimos aplicar la observación"); const r = asRecord(data); return { result: asString(r.result), validation: typeof r.validation === "string" ? r.validation : null };
  }
  async cleanupRateLimits(): Promise<number> {
    const { data, error } = await (await serviceClient()).rpc("payment_rate_limit_cleanup");
    if (error) return fail(error, "No pudimos limpiar los límites"); return asNumber(data);
  }
  async purgeSensitive(retentionDays: number): Promise<number> {
    const { data, error } = await (await serviceClient()).rpc("payment_purge_sensitive", { retention_days: retentionDays });
    if (error) return fail(error, "No pudimos depurar material sensible"); const r = asRecord(data); return asNumber(r.attempts) + asNumber(r.inbox);
  }
}

export class SupabasePaymentRateLimiter implements PaymentRateLimiter {
  async hit(scope: RateLimitScope, subject: string, maxHits: number, windowSeconds: number, signal?: AbortSignal): Promise<RateLimitDecision> {
    const call = (await serviceClient()).rpc("payment_rate_limit_hit", { limit_scope: scope, limit_subject: subject, max_hits: maxHits, window_seconds: windowSeconds });
    const { data, error } = await (signal ? call.abortSignal(signal) : call);
    if (error) return fail(error, "No pudimos verificar el límite de frecuencia"); const r = asRecord(data);
    if (typeof r.allowed !== "boolean") throw new Error("Respuesta de límite inválida");
    return { allowed: r.allowed, retryAfterSeconds: asNumber(r.retry_after_seconds) };
  }
}
