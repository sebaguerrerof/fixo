import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type Call = { name: string; params: Record<string, unknown> };
const calls: Call[] = [];
let reply: { data: unknown; error: { code?: string; message: string } | null } = { data: null, error: null };
const client = { rpc: async (name: string, params: Record<string, unknown>) => { calls.push({ name, params }); return reply; } };
vi.mock("@/integrations/supabase/server-client", () => ({ getSupabaseServerClient: async () => client }));
vi.mock("@/integrations/supabase/payments-service-client", () => ({ getPaymentsServiceClient: () => client }));
import { SupabasePaymentProcessingRepository, SupabasePaymentRepository, mapAdminOverview, mapJobPayments } from "./supabase-payment-repository";
import { PaymentConflictError, PaymentForbiddenError } from "@/repositories/contracts/payment-repository";

/** Contract check against the migration: parameter names of every RPC the repository calls. */
const sql = readFileSync(join(process.cwd(), "supabase/migrations/20261110140000_flow_sandbox_payments.sql"), "utf8");
function signature(name: string): { all: string[]; required: string[] } {
  const m = new RegExp(`create function public\\.${name}\\(([\\s\\S]*?)\\)\\s*returns`, "i").exec(sql);
  if (!m) throw new Error(`RPC ${name} no existe en la migración`);
  const args = m[1].split(",").map((a) => a.trim()).filter(Boolean);
  return { all: args.map((a) => a.split(/\s+/)[0]), required: args.filter((a) => !/\bdefault\b/i.test(a)).map((a) => a.split(/\s+/)[0]) };
}
const expectMatchesMigration = ({ name, params }: Call) => {
  const sig = signature(name);
  for (const k of Object.keys(params ?? {})) expect(sig.all, `${name}: parámetro ${k}`).toContain(k);
  for (const k of sig.required) expect(Object.keys(params ?? {}), `${name}: falta ${k}`).toContain(k);
};
const id = "00000000-0000-4000-8000-000000000001";

beforeEach(() => { calls.length = 0; reply = { data: null, error: null }; });

describe("payment repositories vs the migration contract", () => {
  it("user repository calls match the RPC signatures and map the results", async () => {
    reply = { data: { version: 3, fee_basis_points: 500 }, error: null };
    expect(await new SupabasePaymentRepository().getPolicy()).toEqual({ version: 3, feeBasisPoints: 500 });
    reply = { data: { order_id: "o", attempt_id: "a", commerce_order: "c", attempt_state: "prepared", professional_amount_clp: 100000, platform_fee_clp: 5000, total_clp: 105000, policy_version: 3 }, error: null };
    expect(await new SupabasePaymentRepository().prepare({ jobId: id, extraChargeId: null, expectedPolicyVersion: 3, consent: true, idempotencyKey: id })).toMatchObject({ attemptId: "a", totalClp: 105000, attemptState: "prepared" });
    calls.forEach(expectMatchesMigration); expect(calls.map((c) => c.name)).toEqual(["payment_policy_current", "payment_prepare"]);
  });

  it("processing repository calls match the RPC signatures; bytea goes out as a backslash-x hex string", async () => {
    const repo = new SupabasePaymentProcessingRepository();
    reply = { data: { attempt_id: "a", order_id: "o", commerce_order: "c", amount_clp: 105000, customer_id: "u" }, error: null };
    expect(await repo.beginCreate(id)).toEqual({ attemptId: "a", orderId: "o", commerceOrder: "c", amountClp: 105000, customerId: "u" });
    reply = { data: null, error: null };
    await repo.setCheckout(id, 77, Buffer.from([0, 1, 254, 255]), "k1"); await repo.markAmbiguous(id, "timeout"); await repo.markFailed(id, "http_error");
    reply = { data: { key_id: "k1", ciphertext: "0001feff" }, error: null };
    const got = await repo.getCheckout(id, id); expect(got.keyId).toBe("k1"); expect([...got.ciphertext]).toEqual([0, 1, 254, 255]);
    calls.forEach(expectMatchesMigration);
    expect(calls.find((c) => c.name === "payment_attempt_set_checkout")!.params.ciphertext).toBe("\\x0001feff");
    expect(calls.map((c) => c.name)).toEqual(["payment_attempt_begin_create", "payment_attempt_set_checkout", "payment_attempt_mark_ambiguous", "payment_attempt_mark_failed", "payment_attempt_checkout"]);
  });

  it("maps DB errors to sanitized errors", async () => {
    const repo = new SupabasePaymentProcessingRepository();
    reply = { data: null, error: { code: "PT409", message: "Checkout no disponible" } };
    await expect(repo.getCheckout(id, id)).rejects.toBeInstanceOf(PaymentConflictError);
    reply = { data: null, error: { code: "42501", message: "permission denied for function secret_detail" } };
    const err = await repo.beginCreate(id).catch((e) => e); expect(err).toBeInstanceOf(PaymentForbiddenError); expect(err.message).not.toContain("secret_detail");
    reply = { data: null, error: { code: "XX000", message: "internal stack trace" } };
    const other = await repo.markFailed(id, "x").catch((e) => e); expect(other.message).not.toContain("stack trace");
  });
});

describe("job payments read model and extra response (Sprint 05 stage 5)", () => {
  it("calls job_payments / job_extra_respond with the migration's parameter names", async () => {
    reply = { data: null, error: null };
    expect(await new SupabasePaymentRepository().getJobPayments(id)).toBeNull();
    await new SupabasePaymentRepository().respondExtra({ extraChargeId: id, decision: "accepted", expectedPolicyVersion: 2, reason: null });
    await new SupabasePaymentRepository().respondExtra({ extraChargeId: id, decision: "rejected", expectedPolicyVersion: null, reason: "No lo necesito" });
    expect(calls.map((c) => c.name)).toEqual(["job_payments", "job_extra_respond", "job_extra_respond"]);
    calls.forEach(expectMatchesMigration);
    expect(calls[2].params).toMatchObject({ decision: "rejected", expected_policy_version: null });
  });
  it("proposeExtra matches job_extra_propose and returns the id", async () => {
    reply = { data: { id: "e1", state: "proposed" }, error: null };
    expect(await new SupabasePaymentRepository().proposeExtra({ jobId: id, operationId: id, concept: "Repuesto adicional", amountClp: 20000 })).toBe("e1");
    expectMatchesMigration(calls[0]); expect(calls[0]).toMatchObject({ name: "job_extra_propose", params: { concept_text: "Repuesto adicional", amount: 20000 } });
    reply = { data: null, error: { code: "PT409", message: "El trabajo no admite adicionales ahora" } };
    await expect(new SupabasePaymentRepository().proposeExtra({ jobId: id, operationId: id, concept: "Repuesto adicional", amountClp: 20000 })).rejects.toBeInstanceOf(PaymentConflictError);
  });
  it("maps errors to sanitized types", async () => {
    reply = { data: null, error: { code: "42501", message: "interno" } };
    await expect(new SupabasePaymentRepository().getJobPayments(id)).rejects.toBeInstanceOf(PaymentForbiddenError);
    reply = { data: null, error: { code: "PT409", message: "La política cambió; revisa el nuevo desglose" } };
    await expect(new SupabasePaymentRepository().respondExtra({ extraChargeId: id, decision: "accepted", expectedPolicyVersion: 1, reason: null })).rejects.toBeInstanceOf(PaymentConflictError);
  });
  it("maps the technician view without F/T and fails closed on unknown values", () => {
    const view = mapJobPayments({ job_id: id, payment_state: "weird", policy: { version: 1, fee_basis_points: 500 }, unpaid_extras: true,
      orders: [{ id: "o", origin: "initial", status: "paid", review: false, policy_version: 4, professional_amount_clp: 100000, platform_fee_clp: null, total_clp: null, paid_at: "2026-11-11T10:00:00Z", created_at: "x", latest_attempt_state: "paid", latest_attempt_id: null, simulated_settlement_clp: 100000 }],
      extras: [{ id: "e", concept: "Repuesto", amount_clp: 20000, state: "proposed", created_at: "x" }] });
    expect(view.paymentState).toBe("not_enabled"); expect(view.unpaidExtras).toBe(true);
    expect(view.orders[0]).toMatchObject({ policyVersion: 4, platformFeeClp: null, totalClp: null, latestAttemptId: null, flowCostClp: null, simulatedSettlementClp: 100000, professionalAmountClp: 100000 });
    expect(view.extras[0]).toMatchObject({ amountClp: 20000, state: "proposed" });
    expect(mapJobPayments({}).policy).toBeNull(); expect(mapJobPayments({ orders: "x" }).orders).toEqual([]);
  });
});

describe("administrative RPCs (Sprint 05 stage 5, step C)", () => {
  it("calls payment_admin_overview / payment_policy_set / payment_request_reconciliation with the migration's names", async () => {
    reply = { data: { policy: { version: 2, fee_basis_points: 700, reason: "r", created_at: "t" } }, error: null };
    expect((await new SupabasePaymentRepository().getAdminOverview()).policy).toMatchObject({ version: 2, feeBasisPoints: 700 });
    reply = { data: { version: 3, fee_basis_points: 600 }, error: null };
    expect(await new SupabasePaymentRepository().setPolicy({ expectedVersion: 2, basisPoints: 600, reason: "Ajuste aprobado" })).toEqual({ version: 3, feeBasisPoints: 600 });
    reply = { data: null, error: null }; await new SupabasePaymentRepository().requestReconciliation(id);
    expect(calls.map((c) => c.name)).toEqual(["payment_admin_overview", "payment_policy_set", "payment_request_reconciliation"]); calls.forEach(expectMatchesMigration);
    expect(calls[1].params).toEqual({ expected_version: 2, basis_points: 600, change_reason: "Ajuste aprobado" });
  });
  it("maps stale-version and forbidden errors without leaking internals", async () => {
    reply = { data: null, error: { code: "PT409", message: "La política cambió; actualiza la versión" } };
    await expect(new SupabasePaymentRepository().setPolicy({ expectedVersion: 1, basisPoints: 600, reason: "Ajuste aprobado" })).rejects.toBeInstanceOf(PaymentConflictError);
    reply = { data: null, error: { code: "42501", message: "interno" } };
    await expect(new SupabasePaymentRepository().getAdminOverview()).rejects.toBeInstanceOf(PaymentForbiddenError);
    await expect(new SupabasePaymentRepository().requestReconciliation(id)).rejects.toBeInstanceOf(PaymentForbiddenError);
  });
  it("maps the overview, tolerating missing pieces", () => {
    const o = mapAdminOverview({ policy: { version: 2, fee_basis_points: 700, reason: "r", created_at: "t", author_name: "Ana" },
      history: [{ version: 2, fee_basis_points: 700, reason: "r", created_at: "t", author_name: "Ana" }, { version: 1, fee_basis_points: 500, reason: "inicial", created_at: "t0", author_name: null }],
      pending: [{ attempt_id: "a", order_id: "o", job_id: "j", state: "paid", cost_pending: true, exhausted: true, last_checked_at: null, next_check_at: "n", check_count: 10, error_code: null }],
      reviews: [{ order_id: "o", job_id: "j", reason: "duplicate_payment", status: "paid", updated_at: "u" }], quarantined_inbox: 3 });
    expect(o.history).toHaveLength(2); expect(o.history[1].authorName).toBeNull(); expect(o.pending[0]).toMatchObject({ costPending: true, exhausted: true, lastCheckedAt: null, checkCount: 10 });
    expect(o.reviews[0].reason).toBe("duplicate_payment"); expect(o.quarantinedInbox).toBe(3);
    expect(mapAdminOverview(null)).toEqual({ policy: null, history: [], pending: [], reviews: [], quarantinedInbox: 0 });
  });
});
