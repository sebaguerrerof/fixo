import { describe, it, expect, vi } from "vitest";
import { randomBytes } from "node:crypto";
vi.mock("server-only", () => ({}));
vi.mock("@/repositories/repository-factory", () => ({ getPaymentRepository: () => { throw new Error("unused"); }, getPaymentProcessingRepository: () => { throw new Error("unused"); } }));
import { PaymentService, PaymentOutcomeUnknownError, PaymentRejectedError } from "./payment-service";
import { FlowClient, FlowProviderError, type FlowFetch } from "@/integrations/payments/flow-client";
import { loadFlowConfig } from "@/integrations/payments/flow-config";
import { PaymentsTargetError } from "@/integrations/payments/payments-target";
import { FlowProvider, PaymentsUnavailableError } from "@/integrations/payments/flow-provider";
import { decryptToken, encryptToken } from "@/integrations/payments/token-crypto";
import type { PreparedPayment } from "@/repositories/contracts/payment-repository";

const u = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const key = { id: "k1", key: randomBytes(32) };
const prepared: PreparedPayment = { orderId: u(1), attemptId: u(2), commerceOrder: `fixo-sbx-${u(2).replaceAll("-", "")}`, attemptState: "prepared", professionalAmountClp: 100000, platformFeeClp: 5000, totalClp: 105000, policyVersion: 1 };
const payer = { id: u(9), email: "c@example.com" };
const input = { jobId: u(3), extraChargeId: null, expectedPolicyVersion: 1, consent: true as const, idempotencyKey: u(4) };

function setup(over: { prepared?: Partial<PreparedPayment>; reserved?: Partial<{ amountClp: number; commerceOrder: string }>; create?: () => Promise<unknown>; setCheckout?: () => Promise<void>; enabled?: boolean; stored?: string; wrongTarget?: boolean; limiter?: { hit: () => Promise<{ allowed: boolean; retryAfterSeconds: number }> } } = {}) {
  const calls: string[] = []; let stored: { ciphertext: Buffer; keyId: string; flowOrder: number } | null = null;
  const repository = { getPolicy: async () => ({ version: 1, feeBasisPoints: 500 }), prepare: async () => { calls.push("prepare"); return { ...prepared, ...over.prepared }; }, getJobPayments: async () => null, respondExtra: async () => {}, proposeExtra: async () => "x", getAdminOverview: async () => ({ policy: null, history: [], pending: [], reviews: [], quarantinedInbox: 0, sandboxAccounts: [] }), setPolicy: async () => ({ version: 1, feeBasisPoints: 500 }), requestReconciliation: async () => {} };
  const processing = {
    beginCreate: async () => { calls.push("begin"); return { attemptId: prepared.attemptId, orderId: prepared.orderId, commerceOrder: prepared.commerceOrder, amountClp: 105000, customerId: u(9), ...over.reserved }; },
    setCheckout: async (_a: string, flowOrder: number, ciphertext: Buffer, keyId: string) => { calls.push("setCheckout"); await (over.setCheckout?.() ?? Promise.resolve()); stored = { ciphertext, keyId, flowOrder }; },
    getCheckout: async (_a: string, customerId: string) => { calls.push("getCheckout"); if (over.stored === "denied" || customerId !== u(9)) throw new Error("PT409"); return encryptToken(over.stored ?? "https://sandbox.flow.cl/app/web/pay.php?token=OLD", prepared.attemptId, key) as unknown as { ciphertext: Buffer; keyId: string }; },
    markAmbiguous: async (_a: string, code: string) => { calls.push(`ambiguous:${code}`); },
    markFailed: async (_a: string, code: string) => { calls.push(`failed:${code}`); },
  };
  const provider = {
    createOrder: vi.fn(async () => { calls.push("flow"); return (over.create ? over.create() : { flowOrder: 7, token: "SECRET-TOKEN", checkoutUrl: "https://sandbox.flow.cl/pay?token=SECRET-TOKEN" }); }),
  } as never;
  const rateLimiter = over.limiter ?? { hit: async () => ({ allowed: true, retryAfterSeconds: 0 }) };
  const deps = { repository, processing, provider, creationEnabled: over.enabled ?? true, tokenKey: () => key, assertTarget: () => { calls.push("target"); if (over.wrongTarget) throw new PaymentsTargetError(); }, rateLimiter };
  const service = new PaymentService(deps);
  return { service, deps, calls, provider: provider as { createOrder: ReturnType<typeof vi.fn> }, stored: () => stored };
}

describe("PaymentService.startCheckout", () => {
  it("persists and reserves BEFORE the network call, then stores the encrypted token and redirects", async () => {
    const t = setup(); const res = await t.service.startCheckout(input, payer);
    expect(res).toEqual({ status: "redirect", checkoutUrl: "https://sandbox.flow.cl/pay?token=SECRET-TOKEN", totalClp: 105000 });
    expect(t.calls).toEqual(["target", "prepare", "begin", "flow", "setCheckout"]);
    const s = t.stored()!; expect(s.flowOrder).toBe(7); expect(s.ciphertext.toString("utf8")).not.toContain("SECRET");
    expect(decryptToken(s.ciphertext, s.keyId, prepared.attemptId, key)).toBe("https://sandbox.flow.cl/pay?token=SECRET-TOKEN");
    expect(t.provider.createOrder).toHaveBeenCalledWith(expect.objectContaining({ amountClp: 105000, professionalAmountClp: 100000, platformFeeClp: 5000, commerceOrder: prepared.commerceOrder }));
  });

  it("never calls Flow when creation is disabled or input is invalid", async () => {
    const off = setup({ enabled: false });
    await expect(off.service.startCheckout(input, payer)).rejects.toBeInstanceOf(PaymentsUnavailableError); expect(off.calls).toEqual(["target"]);
    const bad = setup();
    await expect(bad.service.startCheckout({ ...input, consent: false as never }, payer)).rejects.toThrow();
    await expect(bad.service.startCheckout({ ...input, jobId: "x" }, payer)).rejects.toThrow();
    await expect(bad.service.startCheckout(input, { ...payer, email: "not-an-email" })).rejects.toThrow(); expect(bad.calls).toEqual(["target", "target", "target"]);
  });

  it("an attempt that is not freshly prepared is never sent again", async () => {
    for (const attemptState of ["creating", "reconciliation_required", "quarantined"]) {
      const t = setup({ prepared: { attemptState } }); expect(await t.service.startCheckout(input, payer)).toEqual({ status: "in_progress", attemptState });
      expect(t.calls).toEqual(["target", "prepare"]);
    }
  });

  it("a definitively ended attempt (failed/cancelled) is reported as retry_allowed, distinct from ambiguous ones, and is never resent", async () => {
    for (const attemptState of ["failed", "cancelled"]) {
      const t = setup({ prepared: { attemptState } }); expect(await t.service.startCheckout(input, payer)).toEqual({ status: "retry_allowed", attemptState });
      expect(t.calls).toEqual(["target", "prepare"]);
    }
  });

  it("a pending attempt reopens the same checkout without calling Flow or creating anything", async () => {
    const t = setup({ prepared: { attemptState: "pending" } });
    expect(await t.service.startCheckout(input, payer)).toEqual({ status: "redirect", checkoutUrl: "https://sandbox.flow.cl/app/web/pay.php?token=OLD", totalClp: 105000 });
    expect(t.calls).toEqual(["target", "prepare", "getCheckout"]);
  });

  it("refuses to reopen when the DB denies it or the stored URL is not the sandbox host", async () => {
    await expect(setup({ prepared: { attemptState: "pending" }, stored: "denied" }).service.startCheckout(input, payer)).rejects.toThrow();
    for (const stored of ["https://evil.example/pay?token=X", "https://sandbox.flow.cl/pay?token=X&redirect=1", "https://sandbox.flow.cl/pay", "http://sandbox.flow.cl/pay?token=X"])
      await expect(setup({ prepared: { attemptState: "pending" }, stored }).service.startCheckout(input, payer)).rejects.toBeInstanceOf(FlowProviderError);
    await expect(setup({ prepared: { attemptState: "pending" } }).service.startCheckout(input, { ...payer, id: u(8) })).rejects.toThrow();
  });

  it("timeout / network / 5xx / lost response => reconciliation_required, no redirect, no failed state", async () => {
    for (const code of ["timeout", "network", "invalid_response", "unsafe_checkout"] as const) {
      const t = setup({ create: async () => { throw new FlowProviderError(code); } });
      await expect(t.service.startCheckout(input, payer)).rejects.toBeInstanceOf(PaymentOutcomeUnknownError);
      expect(t.calls).toEqual(["target", "prepare", "begin", "flow", `ambiguous:${code}`]);
    }
    const t = setup({ create: async () => { throw new FlowProviderError("http_error", 503); } });
    await expect(t.service.startCheckout(input, payer)).rejects.toBeInstanceOf(PaymentOutcomeUnknownError);
  });

  it("unexpected HTTP statuses (3xx, 403, 404, 408, 429, 4xx proxies) never close the attempt: reconcile, never recreate", async () => {
    for (const status of [301, 302, 402, 403, 404, 408, 409, 418, 429, 499, 500, 504]) {
      const t = setup({ create: async () => { throw new FlowProviderError("http_error", status); } });
      await expect(t.service.startCheckout(input, payer)).rejects.toBeInstanceOf(PaymentOutcomeUnknownError);
      expect(t.calls).toEqual(["target", "prepare", "begin", "flow", "ambiguous:http_error"]);
      expect(t.calls.some((c) => c.startsWith("failed"))).toBe(false);
    }
  });

  it("a definitive 4xx closes the attempt as failed", async () => {
    const t = setup({ create: async () => { throw new FlowProviderError("http_error", 401); } });
    await expect(t.service.startCheckout(input, payer)).rejects.toBeInstanceOf(PaymentRejectedError);
    expect(t.calls).toEqual(["target", "prepare", "begin", "flow", "failed:http_error"]);
  });

  it("failure to persist the checkout after Flow created it is ambiguous, never a redirect", async () => {
    const t = setup({ setCheckout: async () => { throw new Error("db down"); } });
    await expect(t.service.startCheckout(input, payer)).rejects.toBeInstanceOf(PaymentOutcomeUnknownError);
    expect(t.calls).toEqual(["target", "prepare", "begin", "flow", "setCheckout", "ambiguous:checkout_persist_failed"]);
  });

  it("rejects a reservation that differs from the displayed breakdown without calling Flow", async () => {
    for (const reserved of [{ amountClp: 100000 }, { commerceOrder: "other" }]) {
      const t = setup({ reserved }); await expect(t.service.startCheckout(input, payer)).rejects.toThrow();
      expect(t.calls).toEqual(["target", "prepare", "begin", "failed:inconsistent_reservation"]);
    }
    const t = setup({ prepared: { totalClp: 100000 } }); await expect(t.service.startCheckout(input, payer)).rejects.toThrow(); expect(t.calls).toEqual(["target", "prepare"]);
  });

  it("per-user rate limit: a denied hit stops everything before prepare/Flow; a failing limiter fails closed", async () => {
    const denied = setup({ limiter: { hit: async () => ({ allowed: false, retryAfterSeconds: 42 }) } });
    await expect(denied.service.startCheckout(input, payer)).rejects.toMatchObject({ name: "PaymentRateLimitedError", retryAfterSeconds: 42 });
    expect(denied.calls).toEqual(["target"]); expect(denied.provider.createOrder).not.toHaveBeenCalled();
    const broken = setup({ limiter: { hit: async () => { throw new Error("db down"); } } });
    await expect(broken.service.startCheckout(input, payer)).rejects.toMatchObject({ name: "PaymentRateLimiterUnavailableError" });
    expect(broken.calls).toEqual(["target"]); expect(broken.provider.createOrder).not.toHaveBeenCalled();
  });

  it("the limit is keyed by the authenticated user, with the documented window", async () => {
    const hit = vi.fn(async () => ({ allowed: true, retryAfterSeconds: 0 })); const t = setup({ limiter: { hit } });
    await t.service.startCheckout(input, payer); expect(hit).toHaveBeenCalledWith("checkout_user", "user:" + payer.id, 10, 600);
  });

  it("fails before reserving anything when the token key is unavailable", async () => {
    const t = setup(); const svc = new PaymentService({ ...t.deps, tokenKey: () => { throw new Error("no key"); } });
    await expect(svc.startCheckout(input, payer)).rejects.toThrow("no key"); expect(t.calls).toEqual(["target"]);
  });

  it("an error before any request was sent (no-network failure) closes the attempt as failed", async () => {
    const t = setup({ create: async () => { throw new PaymentsUnavailableError(); } });
    await expect(t.service.startCheckout(input, payer)).rejects.toBeInstanceOf(PaymentsUnavailableError);
    expect(t.calls).toEqual(["target", "prepare", "begin", "flow", "failed:not_sent"]);
  });

  it("a non-authorized Supabase target blocks everything: no RPC and no Flow call", async () => {
    const t = setup({ wrongTarget: true });
    await expect(t.service.startCheckout(input, payer)).rejects.toBeInstanceOf(PaymentsTargetError);
    expect(t.calls).toEqual(["target"]); expect(t.provider.createOrder).not.toHaveBeenCalled();
  });

  it("any unexpected failure after the request may have been sent is ambiguous, never failed", async () => {
    for (const boom of [new TypeError("Invalid URL"), new Error("something else"), new RangeError("x")]) {
      const t = setup({ create: async () => { throw boom; } });
      await expect(t.service.startCheckout(input, payer)).rejects.toBeInstanceOf(PaymentOutcomeUnknownError);
      expect(t.calls).toEqual(["target", "prepare", "begin", "flow", "ambiguous:unexpected_error"]);
    }
  });
});

/** Real FlowClient + FlowProvider + PaymentService with only the network and the DB faked. */
describe("PaymentService with the real Flow client and provider", () => {
  const cfg = loadFlowConfig({ FIXO_FLOW_MODE: "sandbox", FLOW_API_KEY: "K", FLOW_SECRET_KEY: "S", FIXO_FLOW_CALLBACK_ORIGIN: "https://fixo.example" });
  function wire(fetcher: FlowFetch) {
    if (cfg.mode !== "sandbox") throw new Error("x"); const calls: string[] = [];
    const processing = {
      beginCreate: async () => ({ attemptId: prepared.attemptId, orderId: prepared.orderId, commerceOrder: prepared.commerceOrder, amountClp: 105000, customerId: u(9) }),
      setCheckout: async () => { calls.push("setCheckout"); }, getCheckout: async () => { throw new Error("unused"); },
      markAmbiguous: async (_a: string, c: string) => { calls.push(`ambiguous:${c}`); }, markFailed: async (_a: string, c: string) => { calls.push(`failed:${c}`); },
    };
    const service = new PaymentService({ repository: { getPolicy: async () => ({ version: 1, feeBasisPoints: 500 }), prepare: async () => prepared, getJobPayments: async () => null, respondExtra: async () => {}, proposeExtra: async () => "x", getAdminOverview: async () => ({ policy: null, history: [], pending: [], reviews: [], quarantinedInbox: 0, sandboxAccounts: [] }), setPolicy: async () => ({ version: 1, feeBasisPoints: 500 }), requestReconciliation: async () => {} }, processing, provider: new FlowProvider(new FlowClient(cfg, fetcher)), creationEnabled: true, tokenKey: () => key, assertTarget: () => {}, rateLimiter: { hit: async () => ({ allowed: true, retryAfterSeconds: 0 }) } });
    return { service, calls };
  }
  const ok = (body: unknown): FlowFetch => async () => ({ status: 200, text: async () => JSON.stringify(body) });

  it("HTTP 200 with a malformed checkout URL leaves the attempt ambiguous, never failed", async () => {
    for (const url of ["http://[bad", "not a url", "https://sandbox.flow.cl/pay?x=1", "https://evil.example/pay"]) {
      const t = wire(ok({ url, token: "T", flowOrder: 9 }));
      await expect(t.service.startCheckout(input, payer)).rejects.toBeInstanceOf(PaymentOutcomeUnknownError);
      expect(t.calls).toEqual(["ambiguous:unsafe_checkout"]);
    }
  });
  it("lost or malformed responses stay ambiguous; a definitive 4xx closes; the happy path persists", async () => {
    const lost = wire(async () => { throw new Error("socket hang up"); });
    await expect(lost.service.startCheckout(input, payer)).rejects.toBeInstanceOf(PaymentOutcomeUnknownError); expect(lost.calls).toEqual(["ambiguous:network"]);
    const bad = wire(ok({ url: "https://sandbox.flow.cl/pay", flowOrder: "" }));
    await expect(bad.service.startCheckout(input, payer)).rejects.toBeInstanceOf(PaymentOutcomeUnknownError); expect(bad.calls).toEqual(["ambiguous:invalid_response"]);
    const refused = wire(async () => ({ status: 401, text: async () => "{}" }));
    await expect(refused.service.startCheckout(input, payer)).rejects.toBeInstanceOf(PaymentRejectedError); expect(refused.calls).toEqual(["failed:http_error"]);
    const good = wire(ok({ url: "https://sandbox.flow.cl/app/web/pay.php", token: "T", flowOrder: 9 }));
    expect(await good.service.startCheckout(input, payer)).toMatchObject({ status: "redirect", checkoutUrl: "https://sandbox.flow.cl/app/web/pay.php?token=T" }); expect(good.calls).toEqual(["setCheckout"]);
  });
});
