import type { JobPaymentOrderView, JobPaymentState, JobPaymentsView } from "@/domain/entities/job-payment";
import { calculatePaymentTerms, type PaymentTerms } from "./pricing";

export type PaymentTone = "ok" | "pending" | "warn";
export interface OrderDisplay { readonly label: string; readonly tone: PaymentTone; readonly hint: string | null }

/**
 * Presentation only. The DB recalculates and revalidates everything; nothing here grants a payment or a state.
 * Flow status 3 is shown as "rechazado" and 4 as "anulado"; neither implies a refund or an unpaid obligation is cancelled.
 */
export function describeOrder(order: Pick<JobPaymentOrderView, "status" | "review" | "latestAttemptState">): OrderDisplay {
  if (order.status === "paid") return order.review
    ? { label: "Pagado, en revisión", tone: "warn", hint: "Registramos una situación que Fixo debe revisar antes de continuar." }
    : { label: "Pagado", tone: "ok", hint: null };
  if (order.review) return { label: "En revisión", tone: "warn", hint: "Fixo revisa este pago. No se crearán nuevos cobros hasta resolverlo." };
  switch (order.latestAttemptState) {
    case "pending": return { label: "Pago iniciado, pendiente de verificación", tone: "pending", hint: "Puedes retomar el pago o actualizar la página para ver su estado." };
    case "creating": case "reconciliation_required": return { label: "Verificando con el proveedor", tone: "pending", hint: "Estamos confirmando el estado antes de permitir otro intento." };
    case "quarantined": return { label: "En revisión", tone: "warn", hint: "Fixo revisa este pago." };
    case "failed": return { label: "Rechazado", tone: "warn", hint: "Puedes intentar el pago nuevamente." };
    case "cancelled": return { label: "Anulado", tone: "warn", hint: "Puedes intentar el pago nuevamente." };
    default: return { label: "Pendiente de pago", tone: "pending", hint: null };
  }
}

/** Customer may (re)start checkout only when no attempt is in an ambiguous/terminal-review state and the order is unpaid and not under review. */
export function orderCanBePaid(order: Pick<JobPaymentOrderView, "status" | "review" | "latestAttemptState">): boolean {
  if (order.status !== "awaiting_payment" || order.review) return false;
  return order.latestAttemptState === null || ["prepared", "pending", "failed", "cancelled"].includes(order.latestAttemptState);
}

/** Informational Q/F/T for an obligation that has no order yet. Returns null when the amount/policy cannot be shown. */
export function previewTerms(amountClp: number | null | undefined, policy: JobPaymentsView["policy"]): PaymentTerms | null {
  if (!policy || typeof amountClp !== "number") return null;
  try { return calculatePaymentTerms(amountClp, policy.feeBasisPoints); } catch { return null; }
}

/** Initial obligation = the single `origin: "initial"` order, if it already exists. */
export const initialOrder = (view: JobPaymentsView): JobPaymentOrderView | undefined => view.orders.find((o) => o.origin === "initial");
export const orderForExtra = (view: JobPaymentsView, extraId: string): JobPaymentOrderView | undefined => view.orders.find((o) => o.extraChargeId === extraId);

/** Terminal job states hide the payment actions in the UI; the DB re-checks anyway. */
export const jobAcceptsNewPayments = (status: string): boolean => !["cancelled", "completed", "disputed"].includes(status);

export const MAX_POLICY_BASIS_POINTS = 2000; // same bound as the DB check (20 %)

/** Admin input "5", "5,25", "5.5" -> basis points using integer arithmetic only. Anything else (or > 20 %) is null. */
export function percentToBasisPoints(text: string): number | null {
  const m = /^(\d{1,2})(?:[.,](\d{1,2}))?$/.exec(text.trim()); if (!m) return null;
  const bp = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0") || "0");
  return bp <= MAX_POLICY_BASIS_POINTS ? bp : null;
}
/** 500 -> "5 %", 525 -> "5,25 %". */
export function formatBasisPoints(bp: number): string {
  const whole = Math.floor(bp / 100), frac = String(bp % 100).padStart(2, "0").replace(/0+$/, "");
  return (frac ? `${whole},${frac}` : String(whole)) + " %";
}

/** Short badge text for the jobs list (projection of the INITIAL payment only; extras are shown in the detail). */
export function paymentStateLabel(state: JobPaymentState | undefined): string {
  switch (state) {
    case "payment_pending": return "Pago iniciado, pendiente de verificación";
    case "paid": return "Pago inicial verificado";
    case "payment_failed": return "Pago rechazado o anulado";
    case "payment_review": return "Pago en revisión";
    default: return "Pago inicial pendiente";
  }
}
