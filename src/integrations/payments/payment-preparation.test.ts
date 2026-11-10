import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { FlowProvider, PaymentsUnavailableError } from "./flow-provider";
import { preparePaymentOrder } from "./prepare-payment-order";
import type { Job } from "@/domain/entities/job";
const id = "499f93bc-ed40-40ef-a3e5-427b7b022a53", quote = "9f6be152-b50e-4f21-b359-5a6c5b81bf0b", request = "94b38d22-ec41-4110-af77-e7cfcce13edb", tech = "4da3f641-ae65-462e-8403-7036ef6571d2";
const job: Job = { id, customerId: id, technicianId: tech, serviceRequestId: request, quoteId: quote, emergencyId: null, status: "awarded", paymentState: "not_enabled", createdAt: "2026-11-09T00:00:00Z", updatedAt: "2026-11-09T00:00:00Z", snapshot: { quoteId: quote, serviceRequestId: request, technicianId: tech, priceClp: 25000, currency: "CLP", description: "Aceptado", materialsIncluded: "", materialsNotIncluded: "", diagnosticVisit: false, estimatedDuration: "2 horas", availableDate: "2026-11-10", conditions: "Aceptadas", acceptedAt: "2026-11-09T00:00:00Z" } };
describe("Flow preparation remains disabled", () => {
  it("uses the frozen exact CLP amount without inventing commission", () => {
    const order = preparePaymentOrder(job, id, "sandbox", "2026-11-09T00:00:00Z");
    expect(order.amountClp).toBe(25000); expect(order.snapshotSha256).toHaveLength(64); expect(order.commerceReference).toBe(`fixo-sandbox-${id}`); expect(order.status).toBe("pending"); expect(Object.isFrozen(order)).toBe(true); expect(order).not.toHaveProperty("commission");
  });
  it("rejects inconsistent snapshots and fractional CLP", () => {
    for (const patch of [{ priceClp: 0 }, { priceClp: 1.5 }, { quoteId: id }, { currency: "USD" }]) expect(() => preparePaymentOrder({ ...job, snapshot: { ...job.snapshot!, ...patch } } as Job, id, "sandbox", "2026-11-09T00:00:00Z")).toThrow();
  });
  it("never authorizes, refunds, creates or reconciles a payment", async () => {
    const provider = new FlowProvider();
    for (const op of [() => provider.authorize(), () => provider.refund(), () => provider.createOrder(), () => provider.reconcile(), () => provider.requestRefund()]) await expect(op()).rejects.toBeInstanceOf(PaymentsUnavailableError);
  });
});
