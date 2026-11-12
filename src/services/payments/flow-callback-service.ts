import "server-only";
import { createHash } from "node:crypto";
import { assertAuthorizedPaymentsTarget } from "@/integrations/payments/payments-target";
import { loadFlowConfig } from "@/integrations/payments/flow-config";
import { encryptToken, loadTokenKey, type TokenKey } from "@/integrations/payments/token-crypto";
import type { PaymentInboxRepository, PaymentRateLimiter } from "@/repositories/contracts/payment-repository";
import { getPaymentInboxRepository, getPaymentRateLimiter } from "@/repositories/repository-factory";
import { loadPaymentSwitches } from "@/integrations/payments/payment-switches";
import { withDeadline } from "./deadline";
import { CALLBACK_LIMIT, PaymentRateLimitedError, enforceRateLimit } from "./payment-rate-limit";

export const MAX_CALLBACK_BODY_BYTES = 2048;
/** Flow tokens are opaque; accept only printable, non-space ASCII of bounded length. */
const TOKEN = /^[\x21-\x7e]{1,256}$/;

export type CallbackOutcome = "accepted" | "rejected" | "unavailable" | "rate_limited";

export interface FlowCallbackDeps {
  readonly inbox: PaymentInboxRepository; readonly tokenKey: () => TokenKey; readonly assertTarget: () => void;
  /** Receiving/verifying already-started payments is independent of the switch for NEW charges (PLAN section 11). */
  readonly receiveEnabled: () => boolean;
  readonly rateLimiter: PaymentRateLimiter;
}

/** Extracts the single `token` from a urlencoded body. The body is untrusted: nothing else in it is read. */
export function parseCallbackToken(body: string): string | null {
  if (body.length === 0 || Buffer.byteLength(body) > MAX_CALLBACK_BODY_BYTES) return null;
  const tokens = new URLSearchParams(body).getAll("token");
  if (tokens.length !== 1 || !TOKEN.test(tokens[0])) return null;
  return tokens[0];
}

/**
 * Durably records the notification trigger. It proves nothing: status and amounts come only from the authenticated provider query
 * done later by the worker. `unavailable` means NOTHING was persisted, so the route must not answer 200.
 */
export interface CallbackReceipt { readonly outcome: CallbackOutcome; readonly retryAfterSeconds?: number }

export async function receiveFlowNotification(body: string, deps: FlowCallbackDeps, rateLimitSubject: string, signal?: AbortSignal): Promise<CallbackOutcome> {
  return (await receiveFlowNotificationDetailed(body, deps, rateLimitSubject, signal)).outcome;
}

export async function receiveFlowNotificationDetailed(body: string, deps: FlowCallbackDeps, rateLimitSubject: string, signal?: AbortSignal): Promise<CallbackReceipt> {
  const token = parseCallbackToken(body); if (!token) return { outcome: "rejected" };
  try {
    deps.assertTarget(); if (!deps.receiveEnabled()) return { outcome: "unavailable" };
    await enforceRateLimit(deps.rateLimiter, CALLBACK_LIMIT, rateLimitSubject, signal);
    const hash = createHash("sha256").update(token, "utf8").digest("hex");
    const { ciphertext, keyId } = encryptToken(token, hash, deps.tokenKey());
    const stored = deps.inbox.receive(hash, ciphertext, keyId, signal);
    await (signal ? withDeadline(signal, stored) : stored); // 200 only after the inbox confirmed persistence within the budget
    return { outcome: "accepted" };
  } catch (error) { return error instanceof PaymentRateLimitedError ? { outcome: "rate_limited", retryAfterSeconds: error.retryAfterSeconds } : { outcome: "unavailable" }; }
}

export function getFlowCallbackDeps(): FlowCallbackDeps {
  return { inbox: getPaymentInboxRepository(), tokenKey: () => loadTokenKey(), assertTarget: () => assertAuthorizedPaymentsTarget(), receiveEnabled: () => loadFlowConfig().mode === "sandbox" && loadPaymentSwitches().notificationsEnabled, rateLimiter: getPaymentRateLimiter() };
}
