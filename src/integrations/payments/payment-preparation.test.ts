import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { FlowProvider, PaymentsUnavailableError, resolveSyntheticPayerEmail } from "./flow-provider";
import { FlowClient, FlowPreSendError, type FlowFetch } from "./flow-client";
import { loadFlowConfig } from "./flow-config";
import { preparePaymentOrder } from "./prepare-payment-order";
import type { Job } from "@/domain/entities/job";
const id = "499f93bc-ed40-40ef-a3e5-427b7b022a53", quote = "9f6be152-b50e-4f21-b359-5a6c5b81bf0b", request = "94b38d22-ec41-4110-af77-e7cfcce13edb", tech = "4da3f641-ae65-462e-8403-7036ef6571d2";
const job: Job = { id, customerId: id, technicianId: tech, serviceRequestId: request, quoteId: quote, emergencyId: null, status: "awarded", paymentState: "not_enabled", createdAt: "2026-11-09T00:00:00Z", updatedAt: "2026-11-09T00:00:00Z", snapshot: { quoteId: quote, serviceRequestId: request, technicianId: tech, priceClp: 100000, currency: "CLP", description: "Aceptado", materialsIncluded: "", materialsNotIncluded: "", diagnosticVisit: false, estimatedDuration: "2 horas", availableDate: "2026-11-10", conditions: "Aceptadas", acceptedAt: "2026-11-09T00:00:00Z" } };
const policy = { feeBasisPoints: 500, version: 1 };
const at = "2026-11-09T00:00:00Z";
const sandbox = loadFlowConfig({ FIXO_FLOW_MODE: "sandbox", FLOW_API_KEY: "K", FLOW_SECRET_KEY: "S", FIXO_FLOW_CALLBACK_ORIGIN: "https://fixo.example" });
const flow = (fetcher: FlowFetch) => { if (sandbox.mode !== "sandbox") throw new Error("x"); return new FlowProvider(new FlowClient(sandbox, fetcher)); };

describe("Payment order preparation", () => {
  it("charges T = Q + F while preserving the snapshot digest and Q", () => {
    const order = preparePaymentOrder(job, id, "sandbox", at, policy);
    expect(order).toMatchObject({ amountClp: 105000, professionalAmountClp: 100000, platformFeeClp: 5000, feeBasisPoints: 500, policyVersion: 1, status: "pending" });
    expect(order.snapshotSha256).toHaveLength(64); expect(Object.isFrozen(order)).toBe(true); expect(order).not.toHaveProperty("commerceReference");
    expect(preparePaymentOrder({ ...job }, id, "sandbox", at, { feeBasisPoints: 700, version: 2 }).snapshotSha256).toBe(order.snapshotSha256);
  });
  it("rejects inconsistent snapshots, fractional CLP and invalid policies", () => {
    for (const patch of [{ priceClp: 0 }, { priceClp: 1.5 }, { quoteId: id }, { currency: "USD" }]) expect(() => preparePaymentOrder({ ...job, snapshot: { ...job.snapshot!, ...patch } } as Job, id, "sandbox", at, policy)).toThrow();
    for (const bad of [{ feeBasisPoints: -1, version: 1 }, { feeBasisPoints: 500, version: 0 }, { feeBasisPoints: 0.5, version: 1 }]) expect(() => preparePaymentOrder(job, id, "sandbox", at, bad)).toThrow();
  });
});

const input = { orderId: id, attemptId: tech, commerceOrder: `fixo-sbx-${tech.replaceAll("-", "")}`, amountClp: 105000, professionalAmountClp: 100000, platformFeeClp: 5000, payerEmail: "c@example.com", subject: "Servicio Fixo" };

describe("FlowProvider", () => {
  it("disabled by default: no operation works and no network is touched", async () => {
    const provider = FlowProvider.fromConfig({ mode: "disabled" });
    for (const op of [() => provider.authorize(), () => provider.refund(), () => provider.requestRefund(), () => provider.createOrder(input), () => provider.reconcile({ token: "t" })]) await expect(op()).rejects.toBeInstanceOf(PaymentsUnavailableError);
  });
  it("sandbox createOrder sends the attempt reference and the total T, not Q", async () => {
    let body = "";
    const provider = flow(async (_u, init) => { body = init.body ?? ""; return { status: 200, text: async () => JSON.stringify({ url: "https://sandbox.flow.cl/app/web/pay.php", token: "T", flowOrder: 5 }) }; });
    const res = await provider.createOrder(input);
    const p = new URLSearchParams(body);
    expect(res.flowOrder).toBe(5); expect(p.get("amount")).toBe("105000"); expect(p.get("commerceOrder")).toBe(input.commerceOrder); expect(p.get("commerceOrder")).not.toContain(id);
  });
  it("synthetic .invalid payers are sent with the owner-configured deliverable address (Flow error 1620); real customers are never replaced; no configuration => nothing is sent", async () => {
    const sentEmail = async (env: Record<string, string | undefined>, payerEmail: string) => {
      if (sandbox.mode !== "sandbox") throw new Error("x"); let body = "";
      const client = new FlowClient(sandbox, async (_u, init) => { body = init.body ?? ""; return { status: 200, text: async () => JSON.stringify({ url: "https://sandbox.flow.cl/app/web/pay.php", token: "T", flowOrder: 5 }) }; });
      await new FlowProvider(client, resolveSyntheticPayerEmail(env)).createOrder({ ...input, payerEmail }); return new URLSearchParams(body).get("email");
    };
    expect(await sentEmail({ FIXO_FLOW_SANDBOX_PAYER_EMAIL: "Owner.Test@Gmail.com" }, "s05f-customer@sandbox.fixo.invalid")).toBe("owner.test@gmail.com");
    expect(await sentEmail({ FIXO_FLOW_SANDBOX_PAYER_EMAIL: "owner.test@gmail.com" }, "real.customer@gmail.com")).toBe("real.customer@gmail.com");
    for (const env of [{}, { FIXO_FLOW_SANDBOX_PAYER_EMAIL: "" }, { FIXO_FLOW_SANDBOX_PAYER_EMAIL: "x@sandbox.invalid" }, { FIXO_FLOW_SANDBOX_PAYER_EMAIL: "not-an-email" }]) await expect(sentEmail(env, "s05f-customer@sandbox.fixo.invalid")).rejects.toBeInstanceOf(FlowPreSendError);
  });
  it("refuses inconsistent totals before any network call and still never refunds", async () => {
    const provider = flow(async () => { throw new Error("no network expected"); });
    await expect(provider.createOrder({ ...input, amountClp: 100000 })).rejects.toThrow("inconsistente");
    await expect(provider.createOrder({ ...input, commerceOrder: "" })).rejects.toThrow("inconsistente");
    await expect(provider.refund()).rejects.toBeInstanceOf(PaymentsUnavailableError);
  });
  it("reconcile dispatches by token, commerce reference or Flow order", async () => {
    const urls: string[] = [];
    const provider = flow(async (u) => { urls.push(new URL(u).pathname); return { status: 200, text: async () => JSON.stringify({ flowOrder: 5, commerceOrder: "c", status: 1, currency: "CLP", amount: 10 }) }; });
    await provider.reconcile({ token: "t" }); await provider.reconcile({ commerceOrder: "c" }); await provider.reconcile({ flowOrder: 5 });
    expect(urls).toEqual(["/api/payment/getStatus", "/api/payment/getStatusByCommerceId", "/api/payment/getStatusByFlowOrder"]);
  });
});
