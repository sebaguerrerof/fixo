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
export class FlowProvider implements PaymentProvider {
  constructor(private readonly client: FlowClient | null = null) {}

  static fromConfig(config: FlowConfig = loadFlowConfig()): FlowProvider {
    return new FlowProvider(config.mode === "sandbox" ? new FlowClient(config) : null);
  }

  async authorize(): Promise<never> { throw new PaymentsUnavailableError(); }
  async refund(): Promise<never> { throw new PaymentsUnavailableError(); }
  async requestRefund(): Promise<never> { throw new PaymentsUnavailableError(); }

  async createOrder(input: CreateOrderInput): Promise<CreatedCheckout> {
    if (!this.client) throw new PaymentsUnavailableError();
    if (!input.commerceOrder || input.amountClp !== input.professionalAmountClp + input.platformFeeClp) throw new FlowPreSendError("Total de la orden inconsistente.");
    return this.client.createPayment({ commerceOrder: input.commerceOrder, subject: input.subject, amountClp: input.amountClp, email: input.payerEmail, confirmationPath: FLOW_CONFIRMATION_PATH, returnPath: FLOW_RETURN_PATH });
  }

  async reconcile(query: ReconcileQuery): Promise<ProviderObservation> {
    if (!this.client) throw new PaymentsUnavailableError();
    if ("token" in query) return this.client.getStatusByToken(query.token);
    if ("commerceOrder" in query) return this.client.getStatusByCommerceId(query.commerceOrder);
    return this.client.getStatusByFlowOrder(query.flowOrder);
  }
}
