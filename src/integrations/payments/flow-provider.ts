import "server-only";
import type { PaymentProvider } from "./payment-provider";
export class PaymentsUnavailableError extends Error {
  constructor() { super("Los pagos Flow requieren integración y autorización de pruebas antes de habilitarse."); this.name = "PaymentsUnavailableError"; }
}
/** Explicitly disabled adapter: no network calls, credentials or success-shaped mock responses. */
export class FlowProvider implements PaymentProvider {
  async authorize(): Promise<never> { throw new PaymentsUnavailableError(); }
  async refund(): Promise<never> { throw new PaymentsUnavailableError(); }
  async createOrder(): Promise<never> { throw new PaymentsUnavailableError(); }
  async reconcile(): Promise<never> { throw new PaymentsUnavailableError(); }
  async requestRefund(): Promise<never> { throw new PaymentsUnavailableError(); }
}
