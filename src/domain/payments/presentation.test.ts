import { describe, expect, it } from "vitest";
import { describeOrder, initialOrder, jobAcceptsNewPayments, orderCanBePaid, orderForExtra, previewTerms } from "./presentation";
import type { JobPaymentOrderView, JobPaymentsView } from "@/domain/entities/job-payment";

const order = (over: Partial<JobPaymentOrderView> = {}): JobPaymentOrderView => ({ id: "o", origin: "initial", extraChargeId: null, status: "awaiting_payment", review: false, policyVersion: 1, professionalAmountClp: 100000, platformFeeClp: 5000, totalClp: 105000,
  paidAt: null, createdAt: "", latestAttemptState: null, latestAttemptId: null, flowCostClp: null, reviewReason: null, marginStatus: null, platformMarginClp: null, simulatedSettlementClp: null, ...over });
const view = (orders: JobPaymentOrderView[]): JobPaymentsView => ({ jobId: "j", paymentState: "not_enabled", environment: "sandbox", policy: { version: 1, feeBasisPoints: 500 }, unpaidExtras: false, orders, extras: [] });

describe("payment presentation", () => {
  it("approved example: Q 100.000 -> F 5.000 -> T 105.000, professional keeps Q", () => {
    expect(previewTerms(100000, { version: 1, feeBasisPoints: 500 })).toMatchObject({ professionalAmountClp: 100000, platformFeeClp: 5000, customerTotalClp: 105000 });
  });
  it("preview fails closed without policy or with invalid amounts", () => {
    expect(previewTerms(100000, null)).toBeNull(); expect(previewTerms(undefined, { version: 1, feeBasisPoints: 500 })).toBeNull();
    expect(previewTerms(0, { version: 1, feeBasisPoints: 500 })).toBeNull(); expect(previewTerms(1.5, { version: 1, feeBasisPoints: 500 })).toBeNull();
  });
  it("maps states without presenting uncertainty as success or as cancellation", () => {
    expect(describeOrder(order()).label).toBe("Pendiente de pago");
    expect(describeOrder(order({ latestAttemptState: "pending" })).tone).toBe("pending");
    for (const s of ["creating", "reconciliation_required"]) expect(describeOrder(order({ latestAttemptState: s })).label).toBe("Verificando con el proveedor");
    expect(describeOrder(order({ latestAttemptState: "failed" })).label).toBe("Rechazado");
    expect(describeOrder(order({ latestAttemptState: "cancelled" })).label).toBe("Anulado");
    expect(describeOrder(order({ status: "paid", latestAttemptState: "paid" }))).toMatchObject({ label: "Pagado", tone: "ok" });
    expect(describeOrder(order({ status: "paid", review: true })).tone).toBe("warn");
    expect(describeOrder(order({ review: true })).label).toBe("En revisión");
  });
  it("only allows paying clean unpaid orders without ambiguous attempts", () => {
    expect(orderCanBePaid(order())).toBe(true);
    for (const s of ["prepared", "pending", "failed", "cancelled"]) expect(orderCanBePaid(order({ latestAttemptState: s }))).toBe(true);
    for (const s of ["creating", "reconciliation_required", "quarantined", "paid"]) expect(orderCanBePaid(order({ latestAttemptState: s }))).toBe(false);
    expect(orderCanBePaid(order({ status: "paid" }))).toBe(false); expect(orderCanBePaid(order({ review: true }))).toBe(false);
  });
  it("finds initial and extra orders; terminal jobs accept no new payments", () => {
    const v = view([order(), order({ id: "x", origin: "extra", extraChargeId: "e1" })]);
    expect(initialOrder(v)?.id).toBe("o"); expect(orderForExtra(v, "e1")?.id).toBe("x"); expect(orderForExtra(v, "e2")).toBeUndefined();
    expect(jobAcceptsNewPayments("scheduled")).toBe(true);
    for (const s of ["cancelled", "completed", "disputed"]) expect(jobAcceptsNewPayments(s)).toBe(false);
  });
});

import { formatBasisPoints, percentToBasisPoints } from "./presentation";
describe("policy percentage input (integer arithmetic)", () => {
  it("parses valid percentages to basis points without floating point", () => {
    expect(percentToBasisPoints("5")).toBe(500); expect(percentToBasisPoints("5,25")).toBe(525); expect(percentToBasisPoints("5.5")).toBe(550); expect(percentToBasisPoints(" 0 ")).toBe(0);
    expect(percentToBasisPoints("20")).toBe(2000); expect(percentToBasisPoints("0.07")).toBe(7); expect(percentToBasisPoints("19.99")).toBe(1999); expect(percentToBasisPoints("1.1")).toBe(110);
  });
  it("rejects anything else, including > 20 % and extra precision", () => {
    for (const bad of ["", "abc", "-1", "20.01", "21", "100", "5.255", "5,", ".5", "1e1", "5 %", "NaN"]) expect(percentToBasisPoints(bad), bad).toBeNull();
  });
  it("formats basis points", () => {
    expect(formatBasisPoints(500)).toBe("5 %"); expect(formatBasisPoints(525)).toBe("5,25 %"); expect(formatBasisPoints(550)).toBe("5,5 %"); expect(formatBasisPoints(0)).toBe("0 %"); expect(formatBasisPoints(2000)).toBe("20 %"); expect(formatBasisPoints(7)).toBe("0,07 %");
  });
});

import { paymentStateLabel } from "./presentation";
describe("jobs list payment badge", () => {
  it("labels every projected state; unknown/missing never reads as paid", () => {
    expect(paymentStateLabel("paid")).toBe("Pago inicial verificado"); expect(paymentStateLabel("payment_review")).toBe("Pago en revisión");
    expect(paymentStateLabel("payment_pending")).toContain("pendiente de verificación"); expect(paymentStateLabel("payment_failed")).toContain("rechazado");
    expect(paymentStateLabel("not_enabled")).toBe("Pago inicial pendiente"); expect(paymentStateLabel(undefined)).toBe("Pago inicial pendiente");
  });
});
