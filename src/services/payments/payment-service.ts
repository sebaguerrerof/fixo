import "server-only";
import { z } from "zod";
import { FlowPreSendError, FlowProviderError, validateStoredCheckoutUrl } from "@/integrations/payments/flow-client";
import { assertAuthorizedPaymentsTarget } from "@/integrations/payments/payments-target";
import { loadFlowConfig } from "@/integrations/payments/flow-config";
import { FlowProvider, PaymentsUnavailableError } from "@/integrations/payments/flow-provider";
import type { PaymentProvider } from "@/integrations/payments/payment-provider";
import { decryptToken, encryptToken, loadTokenKey, type TokenKey } from "@/integrations/payments/token-crypto";
import type { PaymentProcessingRepository, PaymentRateLimiter, PaymentRepository } from "@/repositories/contracts/payment-repository";
import { getPaymentProcessingRepository, getPaymentRateLimiter, getPaymentRepository } from "@/repositories/repository-factory";
import { loadPaymentSwitches } from "@/integrations/payments/payment-switches";
import { CHECKOUT_LIMIT, enforceRateLimit } from "./payment-rate-limit";

/** The provider may have created the charge but we could not confirm it. The attempt is left for reconciliation: never recreate. */
export class PaymentOutcomeUnknownError extends Error {
  constructor() { super("No pudimos confirmar la creación del pago. Verificaremos su estado antes de permitir un nuevo intento."); this.name = "PaymentOutcomeUnknownError"; }
}
/** The provider definitively refused before creating anything; the attempt is closed. */
export class PaymentRejectedError extends Error {
  constructor() { super("El proveedor de pagos rechazó la solicitud. Intenta nuevamente más tarde."); this.name = "PaymentRejectedError"; }
}

const startInput = z.object({
  jobId: z.string().uuid(), extraChargeId: z.string().uuid().nullable(), expectedPolicyVersion: z.number().int().positive(),
  consent: z.literal(true), idempotencyKey: z.string().uuid(),
});
export type StartCheckoutInput = z.input<typeof startInput>;
export type StartCheckoutResult =
  | { readonly status: "redirect"; readonly checkoutUrl: string; readonly totalClp: number }
  | { readonly status: "in_progress"; readonly attemptState: string }
  /** The attempt tied to this idempotency key already ended definitively (rejected/annulled): the caller must start again with a NEW key. */
  | { readonly status: "retry_allowed"; readonly attemptState: string };

export interface PaymentServiceDeps {
  readonly repository: PaymentRepository; readonly processing: PaymentProcessingRepository; readonly provider: PaymentProvider;
  /** Separate switch for NEW charges; verification of already-started payments must not depend on it. */
  readonly creationEnabled: boolean; readonly tokenKey: () => TokenKey;
  /** Throws unless the configured Supabase project is the authorized isolated target. Runs before anything else. */
  readonly assertTarget: () => void;
  /** Persistent per-user limit on checkout creation; failure of the limiter denies the request. */
  readonly rateLimiter: PaymentRateLimiter;
}

export class PaymentService {
  constructor(private readonly deps: PaymentServiceDeps) {}

  /**
   * Only identifiers, policy version, consent and an idempotency key come from the browser.
   * Order of effects: authorize+persist order/attempt -> reserve (`creating`) -> Flow call (outside any DB transaction)
   * -> persist checkout -> only then return the URL. The checkout token is never logged or stored in clear.
   */
  async startCheckout(raw: StartCheckoutInput, payer: { readonly id: string; readonly email: string }): Promise<StartCheckoutResult> {
    this.deps.assertTarget();
    if (!this.deps.creationEnabled) throw new PaymentsUnavailableError();
    const input = startInput.parse(raw); z.string().uuid().parse(payer.id); z.string().email().parse(payer.email); const payerEmail = payer.email;
    const key = this.deps.tokenKey(); // fail before reserving anything if we could not protect the token
    await enforceRateLimit(this.deps.rateLimiter, CHECKOUT_LIMIT, "user:" + payer.id);

    const prepared = await this.deps.repository.prepare(input);
    if (prepared.attemptState === "pending") return this.reopen(prepared.attemptId, prepared.totalClp, payer.id, key);
    // Definitive end (failed/cancelled): a new attempt needs a new idempotency key. creating/reconciliation_required/quarantined stay "in progress": never resend.
    if (prepared.attemptState === "failed" || prepared.attemptState === "cancelled") return { status: "retry_allowed", attemptState: prepared.attemptState };
    if (prepared.attemptState !== "prepared") return { status: "in_progress", attemptState: prepared.attemptState };
    if (prepared.totalClp !== prepared.professionalAmountClp + prepared.platformFeeClp) throw new Error("Desglose de pago inconsistente.");

    const reserved = await this.deps.processing.beginCreate(prepared.attemptId);
    if (reserved.attemptId !== prepared.attemptId || reserved.commerceOrder !== prepared.commerceOrder || reserved.amountClp !== prepared.totalClp) {
      await this.safely(() => this.deps.processing.markFailed(prepared.attemptId, "inconsistent_reservation"));
      throw new Error("La reserva del pago no coincide con el desglose mostrado.");
    }

    let created;
    try {
      created = await this.deps.provider.createOrder({ orderId: prepared.orderId, attemptId: prepared.attemptId, commerceOrder: prepared.commerceOrder, amountClp: prepared.totalClp, professionalAmountClp: prepared.professionalAmountClp, platformFeeClp: prepared.platformFeeClp, payerEmail, subject: "Servicio a domicilio Fixo" });
    } catch (error) {
      // Closing as failed (which allows another attempt) is reserved for provably-unsent requests and definitive provider refusals.
      // ANY other failure after the request may have left the provider is ambiguous: reconcile, never recreate.
      const provablyUnsent = error instanceof PaymentsUnavailableError || error instanceof FlowPreSendError;
      const definitive = error instanceof FlowProviderError && !error.ambiguous;
      if (provablyUnsent || definitive) {
        await this.safely(() => this.deps.processing.markFailed(prepared.attemptId, definitive ? (error as FlowProviderError).code : "not_sent"));
        throw definitive ? new PaymentRejectedError() : error;
      }
      await this.safely(() => this.deps.processing.markAmbiguous(prepared.attemptId, error instanceof FlowProviderError ? error.code : "unexpected_error"));
      throw new PaymentOutcomeUnknownError();
    }

    try {
      const { ciphertext, keyId } = encryptToken(created.checkoutUrl, prepared.attemptId, key);
      await this.deps.processing.setCheckout(prepared.attemptId, created.flowOrder, ciphertext, keyId);
    } catch {
      // Flow holds a payable order we could not record: never redirect, never recreate. Reconciliation recovers it by commerce reference.
      await this.safely(() => this.deps.processing.markAmbiguous(prepared.attemptId, "checkout_persist_failed"));
      throw new PaymentOutcomeUnknownError();
    }
    return { status: "redirect", checkoutUrl: created.checkoutUrl, totalClp: prepared.totalClp };
  }

  /** Same customer, closed tab or other device: reuse the single live checkout. Never creates another charge. */
  private async reopen(attemptId: string, totalClp: number, customerId: string, key: TokenKey): Promise<StartCheckoutResult> {
    const stored = await this.deps.processing.getCheckout(attemptId, customerId);
    // Stored value is the full checkout URL; re-validate the exact host before redirecting the browser.
    return { status: "redirect", checkoutUrl: validateStoredCheckoutUrl(decryptToken(stored.ciphertext, stored.keyId, attemptId, key)), totalClp };
  }

  /** Recovery paths must not mask the original outcome; an abandoned `creating` attempt is picked up by the worker. */
  private async safely(op: () => Promise<void>): Promise<void> { try { await op(); } catch { /* handled by reconciliation */ } }
}

export function getPaymentService(): PaymentService {
  const config = loadFlowConfig();
  return new PaymentService({ repository: getPaymentRepository(), processing: getPaymentProcessingRepository(), provider: FlowProvider.fromConfig(config), creationEnabled: config.mode === "sandbox" && loadPaymentSwitches().creationEnabled, rateLimiter: getPaymentRateLimiter(), tokenKey: () => loadTokenKey(), assertTarget: () => assertAuthorizedPaymentsTarget() });
}
