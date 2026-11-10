import type { PaymentStatus } from "@/domain/enums/payment-status";
import type { PaymentOrder, PaymentAttempt, ReconciliationResult, RefundRequest } from "@/domain/entities/payment-order";

export interface PaymentQuote {
  readonly totalClp: number;
  readonly platformFeeClp: number;
  readonly technicianPayoutClp: number;
}

export interface PaymentResult {
  readonly providerPaymentId: string;
  readonly status: PaymentStatus;
}

export interface PaymentProvider {
  authorize(quote: PaymentQuote): Promise<PaymentResult>;
  refund(providerPaymentId: string, amountClp: number): Promise<PaymentResult>;
  createOrder(order: PaymentOrder, attempt: PaymentAttempt): Promise<{ readonly providerPaymentId: string; readonly checkoutUrl: string }>;
  reconcile(order: PaymentOrder, providerToken: string): Promise<ReconciliationResult>;
  requestRefund(request: RefundRequest): Promise<PaymentResult>;
}
