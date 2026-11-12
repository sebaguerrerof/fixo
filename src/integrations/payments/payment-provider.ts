import type { PaymentStatus } from "@/domain/enums/payment-status";
import type { RefundRequest } from "@/domain/entities/payment-order";

export interface PaymentQuote {
  readonly totalClp: number;
  readonly platformFeeClp: number;
  readonly technicianPayoutClp: number;
}

export interface PaymentResult {
  readonly providerPaymentId: string;
  readonly status: PaymentStatus;
}

export interface CreatedCheckout { readonly flowOrder: number; readonly token: string; readonly checkoutUrl: string }

/** Provider-reported facts only; they become evidence solely when the DB correlates them with an attempt. */
export interface ProviderObservation {
  readonly flowOrder: number; readonly commerceOrder: string; readonly statusCode: number;
  readonly status: "pending" | "paid" | "failed" | "cancelled" | null;
  readonly currency: string; readonly amountClp: number; readonly feeClp: number | null;
}

export type ReconcileQuery = { readonly token: string } | { readonly commerceOrder: string } | { readonly flowOrder: number };

/** Narrow, DB-derived input: nothing here comes from the browser. amountClp is the customer total T = Q + F. */
export interface CreateOrderInput {
  readonly orderId: string; readonly attemptId: string; readonly commerceOrder: string;
  readonly amountClp: number; readonly professionalAmountClp: number; readonly platformFeeClp: number;
  readonly payerEmail: string; readonly subject: string;
}

export interface PaymentProvider {
  authorize(quote: PaymentQuote): Promise<PaymentResult>;
  refund(providerPaymentId: string, amountClp: number): Promise<PaymentResult>;
  createOrder(input: CreateOrderInput): Promise<CreatedCheckout>;
  reconcile(query: ReconcileQuery): Promise<ProviderObservation>;
  requestRefund(request: RefundRequest): Promise<PaymentResult>;
}
