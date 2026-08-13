export const PAYMENT_STATUSES = [
  "pending",
  "requires_action",
  "authorized",
  "paid",
  "partially_refunded",
  "refunded",
  "failed",
  "cancelled",
  "disputed",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
