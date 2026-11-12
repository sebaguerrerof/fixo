import "server-only";
import type { CreateOrderInput, CreatedCheckout, PaymentProvider, ProviderObservation, ReconcileQuery } from "./payment-provider";
import { FlowClient, FlowPreSendError } from "./flow-client";
import { loadFlowConfig, type FlowConfig } from "./flow-config";

export const FLOW_CONFIRMATION_PATH = "/api/payments/flow/confirmation";
export const FLOW_RETURN_PATH = "/api/payments/flow/return";

export class PaymentsUnavailableError extends Error {
  constructor() { super("Los pagos Flow requieren integración y autorización de pruebas antes de habilitarse."); this.name = "PaymentsUnavailableError"; }
}

/**
 * Sandbox adapter. Disabled configuration (default) performs no network calls.
 * authorize/refund/requestRefund stay unavailable: implementing createOrder/reconcile does not enable them.
 */
/** The owner-configured deliverable address for synthetic payers, or null when absent/invalid (never itself a `.invalid` address). */
export function resolveSyntheticPayerEmail(env: Readonly<Record<string, string | undefined>>): string | null {
  const configured = env.FIXO_FLOW_SANDBOX_PAYER_EMAIL?.trim().toLowerCase() || null;
  return configured && /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(configured) && !configured.endsWith(".invalid") ? configured : null;
}

export class FlowProvider implements PaymentProvider {
  /**
   * `syntheticPayerEmail`: Flow validates that the payer e-mail is deliverable (real Sandbox error 1620 for `*.invalid` and for domains without MX),
   * so the synthetic test accounts (which MUST use the reserved `.invalid` TLD) cannot be sent as they are. Only a `.invalid` payer is substituted, and only
   * with an address the owner configured explicitly; a real customer's e-mail is always sent unchanged and never replaced.
   */
  constructor(private readonly client: FlowClient | null = null, private readonly syntheticPayerEmail: string | null = null) {}

  static fromConfig(config: FlowConfig = loadFlowConfig(), env: Readonly<Record<string, string | undefined>> = process.env): FlowProvider {
    return new FlowProvider(config.mode === "sandbox" ? new FlowClient(config) : null, resolveSyntheticPayerEmail(env));
  }

  async authorize(): Promise<never> { throw new PaymentsUnavailableError(); }
  async refund(): Promise<never> { throw new PaymentsUnavailableError(); }
  async requestRefund(): Promise<never> { throw new PaymentsUnavailableError(); }

  async createOrder(input: CreateOrderInput): Promise<CreatedCheckout> {
    if (!this.client) throw new PaymentsUnavailableError();
    if (!input.commerceOrder || input.amountClp !== input.professionalAmountClp + input.platformFeeClp) throw new FlowPreSendError("Total de la orden inconsistente.");
    return this.client.createPayment({ commerceOrder: input.commerceOrder, subject: input.subject, amountClp: input.amountClp, email: this.payerEmailFor(input.payerEmail), confirmationPath: FLOW_CONFIRMATION_PATH, returnPath: FLOW_RETURN_PATH });
  }

  private payerEmailFor(payerEmail: string): string {
    if (!payerEmail.toLowerCase().endsWith(".invalid")) return payerEmail;
    if (!this.syntheticPayerEmail) throw new FlowPreSendError("Una cuenta sintética necesita FIXO_FLOW_SANDBOX_PAYER_EMAIL para pagar en Sandbox.");
    return this.syntheticPayerEmail;
  }

  async reconcile(query: ReconcileQuery): Promise<ProviderObservation> {
    if (!this.client) throw new PaymentsUnavailableError();
    if ("token" in query) return this.client.getStatusByToken(query.token);
    if ("commerceOrder" in query) return this.client.getStatusByCommerceId(query.commerceOrder);
    return this.client.getStatusByFlowOrder(query.flowOrder);
  }
}
