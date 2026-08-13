import type { PaymentStatus } from "@/domain/enums/payment-status";

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
}
