import { describe, it, expect, vi } from "vitest";
import { createHash, randomBytes } from "node:crypto";
vi.mock("server-only", () => ({}));
vi.mock("@/repositories/repository-factory", () => ({ getPaymentWorkerRepository: () => ({}) }));
import { MAX_INBOX_ATTEMPTS, getPaymentWorkerDeps, observationKey, runPaymentWorkerBatch, type PaymentWorkerDeps } from "./payment-worker-service";
import { handleWorkerRun, isWorkerAuthorized } from "./payment-worker-handler";
import { encryptToken } from "@/integrations/payments/token-crypto";
import { FlowProviderError } from "@/integrations/payments/flow-client";
import { PaymentConflictError, type ClaimedAttempt, type ClaimedInbox, type PaymentWorkerRepository } from "@/repositories/contracts/payment-repository";
import type { ProviderObservation } from "@/integrations/payments/payment-provider";

const key = { id: "k1", key: randomBytes(32) };
const sha = (t: string) => createHash("sha256").update(t).digest("hex");
const obs = (over: Partial<ProviderObservation> = {}): ProviderObservation => ({ flowOrder: 77, commerceOrder: "FX-1", statusCode: 2, status: "paid", currency: "CLP", amountClp: 10500, feeClp: 300, ...over });

function inboxItem(token: string, over: Partial<ClaimedInbox> = {}): ClaimedInbox {
  const h = sha(token); const { ciphertext, keyId } = encryptToken(token, h, key);
  return { id: "in-1", tokenCiphertext: ciphertext, tokenSha256: h, keyId, generation: 3, leaseToken: "lease-1", attempt: 1, ...over };
}
function attempt(over: Partial<ClaimedAttempt> = {}): ClaimedAttempt { return { attemptId: "at-1", commerceOrder: "FX-1", flowOrder: null, leaseToken: "al-1", checkCount: 1, state: "reconciliation_required", ...over }; }

function setup(opts: { inbox?: (ClaimedInbox | null)[]; attempts?: (ClaimedAttempt | null)[]; reconcile?: PaymentWorkerDeps["provider"]["reconcile"]; enabled?: boolean; repo?: Partial<PaymentWorkerRepository>; lookup?: string | null } = {}) {
  const inbox = [...(opts.inbox ?? []), null]; const attempts = [...(opts.attempts ?? []), null];
  const calls = { finish: [] as unknown[], release: [] as unknown[], apply: [] as unknown[], lookup: [] as unknown[] };
  const repo: PaymentWorkerRepository = {
    claimInbox: async () => inbox.shift() ?? null, claimDueAttempt: async () => attempts.shift() ?? null,
    finishInbox: async (id, lease, f) => { calls.finish.push({ id, lease, ...f }); },
    releaseAttempt: async (id, lease, delay, code) => { calls.release.push({ id, lease, delay, code }); },
    lookupAttempt: async (c, f) => { calls.lookup.push({ c, f }); return opts.lookup === undefined ? "at-1" : opts.lookup; },
    applyObservation: async (i) => { calls.apply.push(i); return { result: "applied", validation: null }; }, cleanupRateLimits: async () => 0, purgeSensitive: async () => 0, ...opts.repo,
  };
  const reconcile = vi.fn(opts.reconcile ?? (async () => obs()));
  const assertTarget = vi.fn();
  const deps: PaymentWorkerDeps = { repo, provider: { reconcile }, tokenKey: () => key, assertTarget, enabled: () => opts.enabled ?? true };
  return { deps, calls, reconcile, assertTarget };
}

describe("payments worker: inbox", () => {
  it("decrypts with the claim's own fields, queries the provider by token and applies ONLY the verified observation", async () => {
    const { deps, calls, reconcile } = setup({ inbox: [inboxItem("TOK-ABC")] });
    const s = await runPaymentWorkerBatch(deps);
    expect(reconcile).toHaveBeenCalledWith({ token: "TOK-ABC" });
    expect(calls.lookup).toEqual([{ c: "FX-1", f: 77 }]);
    expect(calls.apply).toEqual([{ attemptId: "at-1", eventKey: observationKey(obs(), "at-1"), flowOrder: 77, commerceOrder: "FX-1", statusCode: 2, amountClp: 10500, currency: "CLP", feeClp: 300 }]);
    expect(calls.finish).toEqual([{ id: "in-1", lease: "lease-1", outcome: "done", observedGeneration: 3 }]);
    expect(s.inbox).toBe(1);
  });

  it("duplicate notifications and retries yield the SAME event key (DB dedups => no extra payment); a new fee or status yields a new one", async () => {
    const keys = new Set<string>();
    for (let i = 0; i < 3; i++) { const { deps, calls } = setup({ inbox: [inboxItem("SAME")] }); await runPaymentWorkerBatch(deps); keys.add((calls.apply[0] as { eventKey: string }).eventKey); }
    expect(keys.size).toBe(1);
    expect(observationKey(obs({ feeClp: null }), "at-1")).not.toBe(observationKey(obs(), "at-1")); expect(observationKey(obs({ statusCode: 3 }), "at-1")).not.toBe(observationKey(obs(), "at-1"));
    expect(observationKey(obs({ commerceOrder: "FX-2" }), "at-1")).not.toBe(observationKey(obs(), "at-1")); expect(observationKey(obs(), "at-2")).not.toBe(observationKey(obs(), "at-1")); expect(observationKey(obs(), "11111111-1111-1111-1111-111111111111").length).toBeLessThanOrEqual(200); expect(observationKey(obs(), "at-1").length).toBeLessThanOrEqual(200);
  });

  it("unknown identity is applied with no attempt and the inbox row is QUARANTINED (visible to admins), never done", async () => {
    const { deps, calls } = setup({ inbox: [inboxItem("T")], lookup: null, repo: { applyObservation: async () => ({ result: "quarantined", validation: "unknown_identity" }) } }); const s = await runPaymentWorkerBatch(deps);
    expect(calls.finish).toMatchObject([{ outcome: "quarantine", reason: "quarantined_unknown_identity" }]); expect(s.quarantined).toBe(1);
  });

  it("mismatch and ignored observations also quarantine the notification; duplicates/stale/applied close it as done", async () => {
    for (const [result, validation, outcome] of [["quarantined", "mismatch", "quarantine"], ["ignored", "unknown_status", "quarantine"], ["ignored", "incomplete", "quarantine"], ["duplicate", null, "done"], ["stale", null, "done"], ["pending", null, "done"]] as const) {
      const { deps, calls } = setup({ inbox: [inboxItem("T")], repo: { applyObservation: async () => ({ result, validation }) } }); await runPaymentWorkerBatch(deps);
      expect(calls.finish).toMatchObject([{ outcome }]);
    }
  });

  it("an undecryptable token (wrong context/key) is quarantined without any provider call", async () => {
    const { deps, calls, reconcile } = setup({ inbox: [inboxItem("T", { tokenSha256: sha("other") })] }); const s = await runPaymentWorkerBatch(deps);
    expect(reconcile).not.toHaveBeenCalled(); expect(calls.finish).toMatchObject([{ outcome: "quarantine", reason: "token_undecryptable" }]); expect(s.quarantined).toBe(1);
  });

  it("provider refusal (400/401) quarantines; transient failures retry and never apply; exhaustion quarantines", async () => {
    for (const status of [400, 401]) { const { deps, calls } = setup({ inbox: [inboxItem("T")], reconcile: async () => { throw new FlowProviderError("http_error", status); } }); await runPaymentWorkerBatch(deps); expect(calls.finish).toMatchObject([{ outcome: "quarantine", reason: `flow_http_error_${status}` }]); expect(calls.apply).toHaveLength(0); }
    for (const e of [new FlowProviderError("timeout"), new FlowProviderError("http_error", 503), new FlowProviderError("invalid_response")]) {
      const { deps, calls } = setup({ inbox: [inboxItem("T")], reconcile: async () => { throw e; } }); await runPaymentWorkerBatch(deps); expect(calls.finish).toMatchObject([{ outcome: "retry" }]); expect(calls.apply).toHaveLength(0);
    }
    const { deps, calls } = setup({ inbox: [inboxItem("T", { attempt: MAX_INBOX_ATTEMPTS })], reconcile: async () => { throw new FlowProviderError("timeout"); } }); await runPaymentWorkerBatch(deps);
    expect(calls.finish).toMatchObject([{ outcome: "quarantine", reason: "retry_exhausted" }]);
  });

  it("a failed DB application is retried, never marked done", async () => {
    const { deps, calls } = setup({ inbox: [inboxItem("T")], repo: { applyObservation: async () => { throw new Error("db down"); } } }); await runPaymentWorkerBatch(deps);
    expect(calls.finish).toMatchObject([{ outcome: "retry" }]);
  });

  it("one item failing (lost lease) does not stop the batch", async () => {
    let n = 0; const { deps } = setup({ inbox: [inboxItem("A", { id: "a" }), inboxItem("B", { id: "b" })], repo: { finishInbox: async (id) => { n++; if (id === "a") throw new PaymentConflictError("Lease inválido"); } } });
    const s = await runPaymentWorkerBatch(deps); expect(s.failures).toBe(1); expect(s.inbox).toBe(1); expect(n).toBe(2);
  });
});

describe("payments worker: attempt reconciliation (no callback needed)", () => {
  it("uses the persisted flowOrder, else the commerce order, and releases open attempts with backoff", async () => {
    const a = setup({ attempts: [attempt({ flowOrder: 77 })], reconcile: async () => obs({ statusCode: 1, status: "pending" }), repo: { applyObservation: async () => ({ result: "pending", validation: null }) } }); await runPaymentWorkerBatch(a.deps);
    expect(a.reconcile).toHaveBeenCalledWith({ flowOrder: 77 }); expect(a.calls.release).toMatchObject([{ id: "at-1", lease: "al-1", delay: 60, code: null }]);
    const b = setup({ attempts: [attempt()] }); await runPaymentWorkerBatch(b.deps); expect(b.reconcile).toHaveBeenCalledWith({ commerceOrder: "FX-1" });
  });

  it("reconciliation applies to the CLAIMED attempt even if the response names another one (DB detects the mismatch); lookup is not used", async () => {
    const { deps, calls } = setup({ attempts: [attempt({ attemptId: "A" })], reconcile: async () => obs({ commerceOrder: "FX-OF-B", flowOrder: 999 }) }); await runPaymentWorkerBatch(deps);
    expect(calls.lookup).toHaveLength(0); expect(calls.apply).toMatchObject([{ attemptId: "A", commerceOrder: "FX-OF-B", flowOrder: 999 }]);
  });

  it("a provider failure never applies anything and never recreates: the attempt is released with a sanitized code and growing delay", async () => {
    const { deps, calls } = setup({ attempts: [attempt({ checkCount: 3 })], reconcile: async () => { throw new FlowProviderError("http_error", 400); } }); await runPaymentWorkerBatch(deps);
    expect(calls.apply).toHaveLength(0); expect(calls.release).toMatchObject([{ delay: 240, code: "flow_http_error_400" }]);
  });

  it("a lease already consumed by a terminal application is tolerated; other release failures are counted", async () => {
    const ok = setup({ attempts: [attempt()], repo: { releaseAttempt: async () => { throw new PaymentConflictError("Lease inválido"); } } }); expect((await runPaymentWorkerBatch(ok.deps)).failures).toBe(0);
    const bad = setup({ attempts: [attempt()], repo: { releaseAttempt: async () => { throw new Error("db"); } } }); expect((await runPaymentWorkerBatch(bad.deps)).failures).toBe(1);
  });
});

describe("payments worker: switches and target", () => {
  it("notifications switch off => no claims and no provider (retention still runs, see below); wrong target => throws before anything", async () => {
    const off = setup({ enabled: false, inbox: [inboxItem("T")], attempts: [attempt()] }); const s = await runPaymentWorkerBatch(off.deps);
    expect(off.reconcile).not.toHaveBeenCalled(); expect(s).toEqual({ inbox: 0, attempts: 0, quarantined: 0, retried: 0, failures: 0, cleaned: 0, purged: 0, housekeepingFailures: 0 });
    const bad = setup({ inbox: [inboxItem("T")] }); bad.assertTarget.mockImplementation(() => { throw new Error("wrong project"); });
    await expect(runPaymentWorkerBatch(bad.deps)).rejects.toThrow(); expect(bad.reconcile).not.toHaveBeenCalled();
  });
  it("each pass purges resolved token material with the documented retention; a purge failure never breaks the pass", async () => {
    const seen: number[] = []; const ok = setup({ repo: { purgeSensitive: async (d: number) => { seen.push(d); return 3; } } });
    expect((await runPaymentWorkerBatch(ok.deps)).purged).toBe(3); expect(seen).toEqual([30]);
    const bad = setup({ inbox: [inboxItem("T")], repo: { purgeSensitive: async () => { throw new Error("db"); } } }); const s = await runPaymentWorkerBatch(bad.deps);
    expect(s.purged).toBe(0); expect(s.inbox).toBe(1);
  });
  it("retention keeps running with the notifications switch OFF (rollback state), never claims or calls the provider, and still validates the target", async () => {
    const seen: number[] = []; const off = setup({ enabled: false, inbox: [inboxItem("T")], attempts: [attempt()], repo: { purgeSensitive: async (d: number) => { seen.push(d); return 4; } } });
    const s = await runPaymentWorkerBatch(off.deps);
    expect(seen).toEqual([30]); expect(s).toMatchObject({ inbox: 0, attempts: 0, purged: 4, housekeepingFailures: 0 }); expect(off.reconcile).not.toHaveBeenCalled(); expect(off.calls.finish).toHaveLength(0);
    const bad = setup({ enabled: false }); bad.assertTarget.mockImplementation(() => { throw new Error("wrong project"); });
    await expect(runPaymentWorkerBatch(bad.deps)).rejects.toThrow();
  });
  it("a failing retention RPC (e.g. migration not applied) is counted, not hidden, and does not break the pass", async () => {
    const s = await runPaymentWorkerBatch(setup({ enabled: false, repo: { purgeSensitive: async () => { throw new Error("missing function"); } } }).deps);
    expect(s.purged).toBe(0); expect(s.housekeepingFailures).toBe(1);
  });
  it("the REAL constructor builds without Flow credentials while notifications are off (retention needs only the target and Supabase); with them on and no credentials it fails visibly but still purges", async () => {
    vi.stubEnv("FIXO_FLOW_MODE", "sandbox"); vi.stubEnv("FIXO_PAYMENTS_NOTIFICATIONS_ENABLED", "false"); vi.stubEnv("FLOW_API_KEY", ""); vi.stubEnv("FLOW_SECRET_KEY", ""); vi.stubEnv("FIXO_FLOW_CALLBACK_ORIGIN", "");
    try {
      const real = getPaymentWorkerDeps(); expect(real.enabled()).toBe(false);
      vi.stubEnv("FIXO_PAYMENTS_NOTIFICATIONS_ENABLED", "true"); expect(() => real.enabled()).toThrow();
      const seen: number[] = []; const s = await runPaymentWorkerBatch({ ...setup({ repo: { purgeSensitive: async (d: number) => { seen.push(d); return 1; } } }).deps, enabled: real.enabled });
      expect(seen).toEqual([30]); expect(s.failures).toBe(1); expect(s.purged).toBe(1);
    } finally { vi.unstubAllEnvs(); }
  });
  it("the batch is bounded", async () => {
    const many = Array.from({ length: 10 }, (_, i) => inboxItem("T" + i, { id: "i" + i })); const { deps, calls } = setup({ inbox: many }); await runPaymentWorkerBatch(deps, 3); expect(calls.finish).toHaveLength(3);
  });
});

describe("payments worker endpoint", () => {
  const secret = "s".repeat(40);
  const req = (auth?: string) => new Request("https://x.invalid/api/payments/worker", { method: "POST", headers: auth ? { authorization: auth } : {} });
  it("requires the exact dedicated bearer secret; a missing or short secret disables the endpoint", async () => {
    expect(isWorkerAuthorized(`Bearer ${secret}`, secret)).toBe(true);
    for (const [h, s] of [[null, secret], ["Bearer nope", secret], [`Bearer ${secret}x`, secret], [`Basic ${secret}`, secret], [`Bearer short`, "short"], [`Bearer `, ""], [`Bearer ${secret}`, undefined]] as const) expect(isWorkerAuthorized(h, s)).toBe(false);
    const makeDeps = vi.fn(); expect((await handleWorkerRun(req(), secret, makeDeps)).status).toBe(401); expect((await handleWorkerRun(req("Bearer bad"), secret, makeDeps)).status).toBe(401); expect(makeDeps).not.toHaveBeenCalled();
  });
  it("authorized run returns only counters; failures are sanitized to 503", async () => {
    const ok = await handleWorkerRun(req(`Bearer ${secret}`), secret, () => setup().deps); expect(ok.status).toBe(200); expect(await ok.json()).toEqual({ inbox: 0, attempts: 0, quarantined: 0, retried: 0, failures: 0, cleaned: 0, purged: 0, housekeepingFailures: 0 });
    const bad = await handleWorkerRun(req(`Bearer ${secret}`), secret, () => { throw new Error("secret detail"); }); expect(bad.status).toBe(503); expect(await bad.text()).not.toContain("secret detail");
  });
  it("emits one JSON log line per run (counters / error class only) and never leaks the secret, the bearer header or error messages", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      await handleWorkerRun(req(`Bearer ${secret}`), secret, () => setup().deps);
      await handleWorkerRun(req(`Bearer ${secret}`), secret, () => { throw new Error("secret detail token=abc"); });
      await handleWorkerRun(req("Bearer wrong-value"), secret, () => setup().deps);
      const lines = spy.mock.calls.map((c) => String(c[0])); expect(lines).toHaveLength(3);
      const [run, err, rej] = lines.map((l) => JSON.parse(l));
      expect(run).toMatchObject({ event: "payments_worker_run", status: 200, inbox: 0, housekeepingFailures: 0 }); expect(typeof run.ms).toBe("number");
      expect(err).toMatchObject({ event: "payments_worker_error", status: 503, error: "Error" }); expect(rej).toMatchObject({ event: "payments_worker_rejected", status: 401 });
      const all = lines.join(" | "); for (const forbidden of [secret, "wrong-value", "secret detail", "token=abc", "Bearer"]) expect(all).not.toContain(forbidden);
    } finally { spy.mockRestore(); }
  });
});
