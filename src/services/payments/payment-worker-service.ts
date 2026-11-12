import "server-only";
import { createHash } from "node:crypto";
import { assertAuthorizedPaymentsTarget } from "@/integrations/payments/payments-target";
import { loadFlowConfig } from "@/integrations/payments/flow-config";
import { FlowProvider } from "@/integrations/payments/flow-provider";
import { FlowProviderError } from "@/integrations/payments/flow-client";
import { loadPaymentSwitches } from "@/integrations/payments/payment-switches";
import { decryptToken, loadTokenKey, type TokenKey } from "@/integrations/payments/token-crypto";
import type { PaymentProvider, ProviderObservation, ReconcileQuery } from "@/integrations/payments/payment-provider";
import { PaymentConflictError, type ObservationResult, type ClaimedAttempt, type ClaimedInbox, type ObservationInput, type PaymentWorkerRepository } from "@/repositories/contracts/payment-repository";
import { getPaymentWorkerRepository } from "@/repositories/repository-factory";

/** After this many provider failures a notification is quarantined; attempts keep being reconciled independently of the inbox. */
export const MAX_INBOX_ATTEMPTS = 8;
export const DEFAULT_BATCH_LIMIT = 20;

export interface PaymentWorkerDeps {
  readonly repo: PaymentWorkerRepository; readonly provider: Pick<PaymentProvider, "reconcile">;
  readonly tokenKey: () => TokenKey; readonly assertTarget: () => void; readonly enabled: () => boolean;
}
/** Days a resolved checkout/callback token stays encrypted in the database before its material is purged (hashes, identities and events are kept). */
export const SENSITIVE_RETENTION_DAYS = 30;
export interface WorkerSummary { readonly inbox: number; readonly attempts: number; readonly quarantined: number; readonly retried: number; readonly failures: number; readonly cleaned: number; readonly purged: number; readonly housekeepingFailures: number }

/**
 * Stable identity of one verified observation APPLIED TO one attempt: repeating the same facts for the same attempt (callback or reconciliation) never produces a second effect;
 * a newly known fee or status does; the same facts applied to a different attempt are a different event (a mismatch recorded for A must not shadow the valid payment of B). No local timestamps.
 */
export function observationKey(o: ProviderObservation, attemptId: string | null): string {
  const ref = createHash("sha256").update(o.commerceOrder, "utf8").digest("hex").slice(0, 16);
  return `flow:${attemptId ?? "none"}:${o.flowOrder}:${o.statusCode}:${o.amountClp}:${o.currency}:${o.feeClp ?? "n"}:${ref}`;
}

const backoff = (count: number, base: number, cap: number) => Math.min(cap, base * 2 ** Math.min(Math.max(count, 0), 6));
/** Sanitized, bounded code: never provider bodies or secrets. */
const errorCode = (e: unknown) => e instanceof FlowProviderError ? `flow_${e.code}${e.httpStatus ? `_${e.httpStatus}` : ""}` : "worker_error";

/** attemptId: the attempt the worker EXPECTS (periodic reconciliation, so the DB can detect a mismatch); null only for callbacks, where the identity is resolved from the verified response. */
async function applyVerified(repo: PaymentWorkerRepository, o: ProviderObservation, expectedAttempt: string | null): Promise<ObservationResult> {
  const attemptId = expectedAttempt ?? await repo.lookupAttempt(o.commerceOrder, o.flowOrder);
  const input: ObservationInput = { attemptId, eventKey: observationKey(o, attemptId), flowOrder: o.flowOrder, commerceOrder: o.commerceOrder, statusCode: o.statusCode, amountClp: o.amountClp, currency: o.currency, feeClp: o.feeClp };
  return repo.applyObservation(input);
}

/** A notification is an untrusted trigger: the token only selects WHICH signed provider query to run. Facts come exclusively from that query. */
async function processInbox(deps: PaymentWorkerDeps, item: ClaimedInbox, s: { quarantined: number; retried: number }): Promise<void> {
  const finish = (f: Parameters<PaymentWorkerRepository["finishInbox"]>[2]) => deps.repo.finishInbox(item.id, item.leaseToken, f);
  let token: string;
  try { token = decryptToken(item.tokenCiphertext, item.keyId, item.tokenSha256, deps.tokenKey()); }
  catch { s.quarantined++; await finish({ outcome: "quarantine", reason: "token_undecryptable" }); return; }
  let observation: ProviderObservation;
  try { observation = await deps.provider.reconcile({ token }); }
  catch (error) {
    // Flow refusing the token (400/401) proves it is not a payment of ours: do not retry forever. Anything else may be transient.
    if (error instanceof FlowProviderError && !error.ambiguous) { s.quarantined++; await finish({ outcome: "quarantine", reason: errorCode(error) }); return; }
    if (item.attempt >= MAX_INBOX_ATTEMPTS) { s.quarantined++; await finish({ outcome: "quarantine", reason: "retry_exhausted" }); return; }
    s.retried++; await finish({ outcome: "retry" }); return;
  }
  let applied: ObservationResult;
  try { applied = await applyVerified(deps.repo, observation, null); }
  catch { if (item.attempt >= MAX_INBOX_ATTEMPTS) { s.quarantined++; await finish({ outcome: "quarantine", reason: "apply_exhausted" }); } else { s.retried++; await finish({ outcome: "retry" }); } return; }
  // Quarantined (unknown identity / mismatch) and ignored (incomplete / unknown status) observations need review: they must stay visible, never "done".
  if (applied.result === "quarantined" || applied.result === "ignored") { s.quarantined++; await finish({ outcome: "quarantine", reason: `${applied.result}_${applied.validation ?? "unspecified"}`.slice(0, 100) }); return; }
  await finish({ outcome: "done", observedGeneration: item.generation });
}

/** Periodic reconciliation, independent of callbacks. Identity: persisted flowOrder first, otherwise the commerce order (lost creation response). Never recreates an order. */
async function processAttempt(deps: PaymentWorkerDeps, a: ClaimedAttempt): Promise<void> {
  const query: ReconcileQuery = a.flowOrder !== null ? { flowOrder: a.flowOrder } : { commerceOrder: a.commerceOrder };
  const release = async (delay: number, code: string | null) => { try { await deps.repo.releaseAttempt(a.attemptId, a.leaseToken, delay, code); } catch (e) { if (!(e instanceof PaymentConflictError)) throw e; /* lease already consumed by a terminal application */ } };
  let observation: ProviderObservation;
  try { observation = await deps.provider.reconcile(query); }
  catch (error) { await release(backoff(a.checkCount, 30, 3600), errorCode(error)); return; }
  let result: string;
  try { result = (await applyVerified(deps.repo, observation, a.attemptId)).result; }
  catch (error) { await release(backoff(a.checkCount, 60, 3600), errorCode(error)); return; }
  // Terminal applications clear the lease themselves (release is then a tolerated no-op); open ones are rescheduled with backoff.
  await release(result === "pending" ? backoff(a.checkCount, 30, 900) : 600, null);
}

/** One bounded pass. Disabled switch/target/config => no network and no DB work at all. */
export async function runPaymentWorkerBatch(deps: PaymentWorkerDeps, limit = DEFAULT_BATCH_LIMIT): Promise<WorkerSummary> {
  const s = { inbox: 0, attempts: 0, quarantined: 0, retried: 0, failures: 0, cleaned: 0, purged: 0, housekeepingFailures: 0 };
  deps.assertTarget();
  // Retention is independent of the notifications switch: after a rollback (switch off) encrypted tokens must still expire. It needs no provider and no token key.
  // A misconfiguration while verification is ON (e.g. missing Flow credentials) must not block retention, but it is visible as a failure.
  let on = false; try { on = deps.enabled(); } catch { s.failures++; }
  if (!on) { await housekeeping(deps, s); return s; }
  for (let i = 0; i < limit; i++) {
    const item = await deps.repo.claimInbox(); if (!item) break;
    try { await processInbox(deps, item, s); s.inbox++; } catch { s.failures++; /* lease expires and the row is reclaimed */ }
  }
  for (let i = 0; i < limit; i++) {
    const attempt = await deps.repo.claimDueAttempt(); if (!attempt) break;
    try { await processAttempt(deps, attempt); s.attempts++; } catch { s.failures++; }
  }
  await housekeeping(deps, s);
  return s;
}

/** Rate-limit cleanup + retention of encrypted provider tokens (only resolved records; pending/ambiguous ones stay recoverable). A failure never breaks a pass but is COUNTED, so a missing RPC (migration not applied) is visible in the response. */
async function housekeeping(deps: PaymentWorkerDeps, s: { cleaned: number; purged: number; housekeepingFailures: number }): Promise<void> {
  try { s.cleaned = await deps.repo.cleanupRateLimits(); } catch { s.housekeepingFailures++; }
  try { s.purged = await deps.repo.purgeSensitive(SENSITIVE_RETENTION_DAYS); } catch { s.housekeepingFailures++; }
}

/** Notifications switch governs verification of already-started payments; creation switch is irrelevant here (PLAN section 11). */
export function getPaymentWorkerDeps(): PaymentWorkerDeps {
  // Flow configuration/credentials are loaded ONLY once verification is enabled: retention/housekeeping needs just the authorized target and Supabase server credentials.
  let provider: FlowProvider | null = null;
  const flow = (): FlowProvider => (provider ??= FlowProvider.fromConfig(loadFlowConfig()));
  return {
    repo: getPaymentWorkerRepository(), tokenKey: () => loadTokenKey(), assertTarget: () => assertAuthorizedPaymentsTarget(),
    provider: { reconcile: query => flow().reconcile(query) },
    enabled: () => loadPaymentSwitches().notificationsEnabled && loadFlowConfig().mode === "sandbox",
  };
}
