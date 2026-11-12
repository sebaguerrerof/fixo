import type { PaymentStatus } from "@/domain/enums/payment-status";

/** Official Flow states: 1 pending, 2 paid, 3 rejected, 4 annulled. Unknown values never enable execution. */
export function mapFlowStatus(code: number): Extract<PaymentStatus, "pending" | "paid" | "failed" | "cancelled"> | null {
  switch (code) {
    case 1: return "pending";
    case 2: return "paid";
    case 3: return "failed";
    case 4: return "cancelled";
    default: return null;
  }
}
