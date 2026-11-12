import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const state: { user: { id: string; email: string; role: string } | null; start: () => Promise<unknown> } = { user: null, start: async () => ({}) };
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/services/auth/server-authentication-service", () => ({ getServerAuthenticatedUser: async () => state.user }));
const repo = { setPolicy: vi.fn(async () => ({ version: 2, feeBasisPoints: 700 })), requestReconciliation: vi.fn(async () => {}) };
vi.mock("@/repositories/repository-factory", () => ({ getPaymentRepository: () => repo }));
vi.mock("@/services/payments/payment-service", async () => {
  class PaymentOutcomeUnknownError extends Error { constructor() { super("No pudimos confirmar la creación del pago."); } }
  class PaymentRejectedError extends Error { constructor() { super("El proveedor de pagos rechazó la solicitud."); } }
  return { PaymentOutcomeUnknownError, PaymentRejectedError, getPaymentService: () => ({ startCheckout: () => state.start() }) };
});
import { requestPaymentReconciliation, startPayment, updateFeePolicy } from "./payments";
import { PaymentOutcomeUnknownError, PaymentRejectedError } from "@/services/payments/payment-service";

const id = "00000000-0000-4000-8000-000000000001";
const input = { jobId: id, extraChargeId: null, expectedPolicyVersion: 1, consent: true, idempotencyKey: id };
beforeEach(() => { state.user = { id, email: "c@example.com", role: "customer" }; });

describe("startPayment idempotency-key renewal", () => {
  it("renews the key after a definitive provider rejection", async () => {
    state.start = async () => { throw new PaymentRejectedError(); };
    expect(await startPayment(input)).toMatchObject({ ok: false, renewKey: true });
  });
  it("renews the key when the previous attempt already ended (retry_allowed)", async () => {
    state.start = async () => ({ status: "retry_allowed", attemptState: "failed" });
    expect(await startPayment(input)).toMatchObject({ ok: false, renewKey: true });
  });
  it("keeps the key for ambiguous or in-progress outcomes so nothing is duplicated", async () => {
    state.start = async () => { throw new PaymentOutcomeUnknownError(); };
    expect(await startPayment(input)).toEqual({ ok: false, message: expect.any(String) });
    state.start = async () => ({ status: "in_progress", attemptState: "reconciliation_required" });
    const r = await startPayment(input); expect(r).toMatchObject({ ok: false }); expect((r as { renewKey?: boolean }).renewKey).toBeUndefined();
  });
  it("blames the user only for validation errors; a misconfiguration reads as unavailable", async () => {
    state.start = async () => { throw new Error("Faltan credenciales Flow Sandbox."); };
    expect(await startPayment(input)).toEqual({ ok: false, message: "Los pagos no están disponibles por ahora." });
    state.start = async () => { const { z } = await import("zod"); z.literal(true).parse(false); return {}; };
    expect(await startPayment(input)).toMatchObject({ ok: false, message: expect.stringContaining("Revisa el consentimiento") });
  });
  it("returns the checkout on success and rejects non-customers", async () => {
    state.start = async () => ({ status: "redirect", checkoutUrl: "https://sandbox.flow.cl/app/web/pay.php?token=x", totalClp: 105000 });
    expect(await startPayment(input)).toMatchObject({ ok: true, totalClp: 105000 });
    state.user = { id, email: "t@example.com", role: "technician" }; expect(await startPayment(input)).toMatchObject({ ok: false });
  });
});

describe("administrative actions", () => {
  const policy = { expectedVersion: 1, basisPoints: 700, reason: "Ajuste comercial aprobado" };
  beforeEach(() => { repo.setPolicy.mockClear(); repo.requestReconciliation.mockClear(); });
  it("only a superadmin can change the fee or schedule a re-check (others denied before any repository call)", async () => {
    for (const role of ["moderator", "customer", "technician"]) {
      state.user = { id, email: "x@example.com", role };
      expect(await updateFeePolicy(policy)).toMatchObject({ ok: false }); expect(await requestPaymentReconciliation({ attemptId: id })).toMatchObject({ ok: false });
    }
    state.user = null; expect(await updateFeePolicy(policy)).toMatchObject({ ok: false });
    expect(repo.setPolicy).not.toHaveBeenCalled(); expect(repo.requestReconciliation).not.toHaveBeenCalled();
  });
  it("validates the input and forwards a valid change", async () => {
    state.user = { id, email: "a@example.com", role: "superadmin" };
    for (const bad of [{ ...policy, basisPoints: 2001 }, { ...policy, basisPoints: -1 }, { ...policy, basisPoints: 5.5 }, { ...policy, reason: "corto" }, { ...policy, expectedVersion: 0 }]) expect(await updateFeePolicy(bad)).toMatchObject({ ok: false });
    expect(repo.setPolicy).not.toHaveBeenCalled();
    expect(await updateFeePolicy(policy)).toMatchObject({ ok: true }); expect(repo.setPolicy).toHaveBeenCalledWith(policy);
    expect(await requestPaymentReconciliation({ attemptId: "no-uuid" })).toMatchObject({ ok: false });
    expect(await requestPaymentReconciliation({ attemptId: id })).toMatchObject({ ok: true }); expect(repo.requestReconciliation).toHaveBeenCalledWith(id);
  });
  it("surfaces a stale-version conflict as a sanitized message", async () => {
    state.user = { id, email: "a@example.com", role: "superadmin" };
    const { PaymentConflictError } = await import("@/repositories/contracts/payment-repository");
    repo.setPolicy.mockRejectedValueOnce(new PaymentConflictError("La política cambió; actualiza la versión"));
    expect(await updateFeePolicy(policy)).toEqual({ ok: false, message: "La política cambió; actualiza la versión" });
  });
});
