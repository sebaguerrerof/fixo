import { afterAll, beforeEach, describe, it, expect, vi } from "vitest";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
vi.mock("server-only", () => ({}));
import { applyClosure, assertAllowedPayer, buildRetireCriterionSql, classifyCreate, classifyReconciliation, closureState, flowCost, openExternalIssues, strictInt } from "../../../scripts/flow-sandbox/logic.mjs";
import { readManifest, updateManifest, withManifestLock, writeManifest } from "../../../scripts/flow-sandbox/lib.mjs";
import { memoryLock, runCostCorrection } from "../../../scripts/flow-sandbox/recost-core.mjs";

const OWNER = "owner.test@gmail.com";

describe("remote Sandbox tooling: payer address filter", () => {
  it("accepts only the configured address or a well-formed synthetic .invalid address", () => {
    expect(assertAllowedPayer("Owner.Test@Gmail.com", OWNER)).toBe(OWNER);
    expect(assertAllowedPayer("s05f601d9e-customer@sandbox.fixo.invalid", OWNER)).toBe("s05f601d9e-customer@sandbox.fixo.invalid");
    expect(assertAllowedPayer("a@b.invalid", undefined)).toBe("a@b.invalid");           // synthetic needs no configuration
  });
  it("refuses third parties of any domain, even when something else is configured", () => {
    for (const third of ["outsider@example.org", "stranger@example.com", "someone@yahoo.com", "x@soyfixo.cl", "owner.test@gmail.com.evil.com", "a@b.invalid.evil.com", "x@.invalid", "@b.invalid", "a b@c.invalid", "real.customer@gmail.com"]) {
      expect(() => assertAllowedPayer(third, OWNER), third).toThrow(); expect(() => assertAllowedPayer(third, undefined), third).toThrow();
    }
  });
  it("refuses an absent or invalid value and an unusable configuration", () => {
    for (const bad of [undefined, null, "", "   ", 42, {}, "not-an-email"]) expect(() => assertAllowedPayer(bad, OWNER)).toThrow();
    expect(() => assertAllowedPayer(OWNER, undefined)).toThrow(); expect(() => assertAllowedPayer(OWNER, "")).toThrow(); expect(() => assertAllowedPayer(OWNER, "other@gmail.com")).toThrow();
    expect(() => assertAllowedPayer("x@y.invalid.com", "x@y.invalid")).toThrow();         // a .invalid "configured" address never widens the filter
  });
});

describe("remote Sandbox tooling: payment/create classification", () => {
  const ok = JSON.stringify({ url: "https://sandbox.flow.cl/app/web/pay.php", token: "T", flowOrder: 11657296 });
  it("created needs a 200 with token AND flowOrder", () => {
    expect(classifyCreate({ http: 200, bodyText: ok })).toEqual({ state: "created", http: 200, flowOrder: "11657296" });
    for (const body of [JSON.stringify({ token: "T" }), JSON.stringify({ flowOrder: 1 }), JSON.stringify({ token: "", flowOrder: 1 }), JSON.stringify({ token: "T", flowOrder: "x" }), "<html>ok</html>", "", "null", "[]"]) expect(classifyCreate({ http: 200, bodyText: body }).state, body).toBe("ambiguous");
  });
  it("refused is reserved for documented definitive 400/401 errors with the {code,message} body", () => {
    expect(classifyCreate({ http: 400, bodyText: JSON.stringify({ code: 1622, message: "The commerceOrder can not be longer than 45 characters" }) })).toMatchObject({ state: "refused", http: 400, code: 1622 });
    expect(classifyCreate({ http: 401, bodyText: JSON.stringify({ code: 105, message: "x" }) }).state).toBe("refused");
    for (const body of ["<html>bad gateway</html>", "", JSON.stringify({ message: "x" }), JSON.stringify({ code: "1", message: "x" }), JSON.stringify({ code: 1 })]) expect(classifyCreate({ http: 400, bodyText: body }).state, body).toBe("ambiguous");
  });
  it("any other HTTP status, a lost answer or a network error is ambiguous (Flow may have created the order)", () => {
    for (const http of [301, 302, 403, 404, 408, 429, 500, 502, 503, 504]) expect(classifyCreate({ http, bodyText: JSON.stringify({ code: 1, message: "x" }) }).state, String(http)).toBe("ambiguous");
    expect(classifyCreate({ networkError: new Error("timeout") }).state).toBe("ambiguous"); expect(classifyCreate({}).state).toBe("ambiguous"); expect(classifyCreate({ http: null }).state).toBe("ambiguous");
  });
});

describe("remote Sandbox tooling: reconciliation of an external order", () => {
  const entry = { commerceOrder: "fixo-sbx-6710d0c209d0493582b421f6ca675989", flowOrder: "11657296" };
  const answer = (over: Record<string, unknown> = {}) => ({ http: 200, json: { flowOrder: 11657296, commerceOrder: entry.commerceOrder, status: 1, amount: "26250", currency: "CLP", ...over } });
  it("classifies each Flow status explicitly and keeps pending, paid and unknown OPEN", () => {
    expect(classifyReconciliation(entry, answer({ status: 1 }))).toMatchObject({ flowState: "pending", open: true, problem: "still_payable" });
    expect(classifyReconciliation(entry, answer({ status: 2 }))).toMatchObject({ flowState: "paid", open: true, problem: "paid_outside_fixo" });
    expect(classifyReconciliation(entry, answer({ status: 3 }))).toMatchObject({ flowState: "rejected", open: false });
    expect(classifyReconciliation(entry, answer({ status: 4 }))).toMatchObject({ flowState: "cancelled", open: false });
    expect(classifyReconciliation(entry, answer({ status: 9 }))).toMatchObject({ flowState: "unknown", open: true });
  });
  it("a failed query never concludes anything: unknown and open", () => {
    for (const a of [{ http: 500, json: null }, { http: 400, json: { code: 1, message: "x" } }, { http: 404, json: null }, { networkError: new Error("x") }, {}]) expect(classifyReconciliation(entry, a)).toMatchObject({ flowState: "unknown", open: true });
    expect(classifyReconciliation(entry, { http: 500, json: null }).problem).toBe("query_http_500"); expect(classifyReconciliation(entry, { networkError: new Error("x") }).problem).toBe("query_failed");
  });
  it("validates the structure and the IDENTITY against the recorded entry", () => {
    for (const json of [null, "x", {}, { flowOrder: 1, status: 2 }, { flowOrder: "abc", commerceOrder: entry.commerceOrder, status: 2 }, { flowOrder: 11657296, commerceOrder: entry.commerceOrder, status: "two" }]) expect(classifyReconciliation(entry, { http: 200, json })).toMatchObject({ flowState: "unknown", open: true, problem: "invalid_structure" });
    expect(classifyReconciliation(entry, answer({ commerceOrder: "fixo-sbx-ffffffffffffffffffffffffffffffff", status: 2 }))).toMatchObject({ flowState: "unknown", open: true, problem: "identity_mismatch_commerce_order" });
    expect(classifyReconciliation(entry, answer({ flowOrder: 99999999, status: 3 }))).toMatchObject({ flowState: "unknown", open: true, problem: "identity_mismatch_flow_order" });
    expect(classifyReconciliation({ commerceOrder: entry.commerceOrder }, answer({ status: 3 }))).toMatchObject({ flowState: "rejected", open: false });   // flowOrder not known yet: recovered by commerceOrder
  });
  it("open external issues block the closure: pending, paid, unknown, never reconciled and ambiguous; refused and final non-payable do not", () => {
    const manifest = { externalOrders: [
      { commerceOrder: "a", state: "created", reconciliation: { open: true, problem: "still_payable" } },
      { commerceOrder: "b", state: "created", reconciliation: { open: false, flowState: "rejected" } },
      { commerceOrder: "c", state: "ambiguous" },
      { commerceOrder: "d", state: "refused" },
      { commerceOrder: "e", state: "sending" },
      { commerceOrder: "f", state: "created", reconciliation: { open: true, problem: "paid_outside_fixo" } },
    ] };
    expect(openExternalIssues(manifest).map((i) => i.commerceOrder)).toEqual(["a", "c", "e", "f"]); expect(openExternalIssues(null)).toEqual([]); expect(openExternalIssues({})).toEqual([]);
  });
});

describe("remote Sandbox tooling: criterion retirement SQL", () => {
  const sqlText = buildRetireCriterionSql({ criterion: "938e3f97-4860-4a27-a1c3-777f072e2bce", run: "s05f601d9e", technician: "9e74439f-731e-42ae-a4b2-bcd99c2bdba0", before: { n: 0, d: "d41d8cd98f00b204e9800998ecf8427e" } });
  it("is one atomic block that locks, verifies, deletes by UUID+key and validates the digest (raising rolls the delete back)", () => {
    expect(sqlText.startsWith("do $retire$")).toBe(true);
    const order = ["lock table private.technician_applications in exclusive mode", "lock table private.category_requirements in access exclusive mode", "a.technician_id <>", "delete from private.category_requirements", "if n <> 0 or d <> 'd41d8cd98f00b204e9800998ecf8427e' then raise exception"].map((s) => sqlText.indexOf(s));
    expect(order.every((i) => i >= 0)).toBe(true); expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(sqlText).toContain("id = '938e3f97-4860-4a27-a1c3-777f072e2bce'::uuid and requirement_key = 's05f601d9e'");
  });
  it("escapes quotes in every literal", () => {
    expect(buildRetireCriterionSql({ criterion: "x'y", run: "r'1", technician: "t'2", before: { n: 1, d: "d'3" } })).toContain("'x''y'");
  });
});

describe("remote Sandbox tooling: Flow cost rule parity with the application", () => {
  it("the script mirror and FlowClient agree on every sample (so the one-off data correction uses the shipped rule)", async () => {
    const { FlowClient } = await import("./flow-client");
    const cfg = { mode: "sandbox", apiKey: "K", secretKey: "S", apiBase: "https://sandbox.flow.cl/api", callbackOrigin: "https://x.example" } as const;
    const samples: unknown[] = [{ fee: "837.00", taxes: 159, balance: 25254 }, { fee: "837.00", taxes: "159.00" }, { fee: 837, taxes: 0 }, { fee: "837.00" }, { taxes: 159 }, { fee: "837.50", taxes: 159 }, { fee: "837.00", taxes: 159, balance: 1 }, null, {}];
    for (const pd of samples) {
      const client = new FlowClient(cfg, async () => ({ status: 200, text: async () => JSON.stringify({ flowOrder: 9, commerceOrder: "c", status: 2, currency: "CLP", amount: "26250", paymentData: pd }) }));
      expect(flowCost("26250", pd), JSON.stringify(pd)).toBe((await client.getStatusByToken("t")).feeClp);
    }
  });
});

describe("remote Sandbox tooling: malformed Flow states can never close a reconciliation", () => {
  const entry = { commerceOrder: "fixo-sbx-6710d0c209d0493582b421f6ca675989", flowOrder: "11657296" };
  const withStatus = (status: unknown, flowOrder: unknown = 11657296) => classifyReconciliation(entry, { http: 200, json: { flowOrder, commerceOrder: entry.commerceOrder, status, amount: "26250", currency: "CLP" } });
  it("only canonical integers or plain decimal strings are states: arrays, booleans, exponent, hex, signs, spaces and leading zeros stay unknown and OPEN", () => {
    for (const bad of [[3], [4], "3e0", "0x4", "4e0", true, false, "3.0", " 3", "3 ", "03", "+3", "-3", "", {}, null, undefined, 3.5, -1, Number.NaN, "٣", "3\n"]) {
      expect(withStatus(bad), JSON.stringify(bad)).toMatchObject({ flowState: "unknown", open: true, problem: "invalid_structure" });
    }
    for (const bad of [[11657296], "1e7", "0x10", true, "011657296", "0", 0, " 11657296", 1.5]) expect(withStatus(3, bad), JSON.stringify(bad)).toMatchObject({ flowState: "unknown", open: true, problem: "invalid_structure" });
  });
  it("canonical values are still understood (number or decimal string)", () => {
    expect(withStatus(3)).toMatchObject({ flowState: "rejected", open: false }); expect(withStatus("3")).toMatchObject({ flowState: "rejected", open: false });
    expect(withStatus("4")).toMatchObject({ flowState: "cancelled", open: false }); expect(withStatus("2")).toMatchObject({ flowState: "paid", open: true });
    expect(withStatus(1, "11657296")).toMatchObject({ flowState: "pending", open: true });
    expect([strictInt(0), strictInt("0"), strictInt("12"), strictInt([1]), strictInt("1e1")]).toEqual([0, 0, 12, null, null]);
  });
});

describe("remote Sandbox tooling: retention is not the financial closure", () => {
  const retained = { retainedAt: "2026-11-12T20:00:00Z" };
  it("stays closure-pending while any external order is open and closes only when none is", () => {
    expect(closureState(null)).toBe("open"); expect(closureState({ externalOrders: [] })).toBe("open");                      // not retained yet
    const pending = { ...retained, externalOrders: [{ commerceOrder: "a", state: "created", reconciliation: { open: true, problem: "still_payable" } }] };
    expect(closureState(pending)).toBe("retained-closure-pending");
    for (const reconciliation of [{ open: true, problem: "paid_outside_fixo" }, { open: true, problem: "query_failed" }, undefined]) expect(closureState({ ...retained, externalOrders: [{ commerceOrder: "a", state: "created", reconciliation }] })).toBe("retained-closure-pending");
    expect(closureState({ ...retained, externalOrders: [{ commerceOrder: "a", state: "ambiguous" }] })).toBe("retained-closure-pending");
    expect(closureState({ ...retained, externalOrders: [{ commerceOrder: "a", state: "created", reconciliation: { open: false, flowState: "rejected" } }, { commerceOrder: "b", state: "refused" }] })).toBe("closed-retained");
    expect(closureState({ ...retained })).toBe("closed-retained");
  });
});

interface Entry { order: string; from: number | null; to: number; state: string; recovered?: boolean; resolvedAt?: string; id?: string; kind?: string; found?: number | null }
describe("remote Sandbox tooling: durable, idempotent Flow-cost correction", () => {
  const mk = (costs: Record<string, number | null>, targets: Record<string, number | null>) => {
    const db = new Map(Object.entries(costs)); let manifest: { notes: string[]; costCorrectionLog?: Entry[] } = { notes: [] }; let updates = 0;
    const deps = (over: Record<string, unknown> = {}) => ({
      rows: Object.keys(costs).map((id) => ({ id, cost: db.get(id) ?? null })),
      getCost: async ({ id }: { id: string }) => targets[id] ?? null, readCost: async (id: string) => db.get(id) ?? null,
      applyUpdate: async (id: string, from: number | null, to: number) => { updates++; if ((db.get(id) ?? null) !== from) return []; db.set(id, to); return [{ flow_cost_clp: to }]; },
      load: async () => structuredClone(manifest), save: async (m: typeof manifest) => { manifest = structuredClone(m); }, now: () => "T", ...over,
    });
    return { db, deps, manifest: () => manifest, updates: () => updates };
  };
  it("writes the intent (old and new value) BEFORE each update and confirms it with RETURNING", async () => {
    const t = mk({ a: 837, b: 335 }, { a: 996, b: 399 }); const seen: unknown[] = [];
    const sum = await runCostCorrection(t.deps({ applyUpdate: async (id: string, _from: number, to: number) => { seen.push(structuredClone(t.manifest().costCorrectionLog!.find((e: Entry) => e.order === id))); t.db.set(id, to); return [{ flow_cost_clp: to }]; } }) as never);
    expect(sum).toEqual({ applied: 2, recovered: 0, skipped: 0, conflicts: 0 });
    expect(seen).toEqual([{ id: expect.any(String), order: "a", from: 837, to: 996, state: "intent", at: "T" }, { id: expect.any(String), order: "b", from: 335, to: 399, state: "intent", at: "T" }]);   // durable before the update
    expect(t.manifest().costCorrectionLog!.map((e: Entry) => [e.order, e.from, e.to, e.state])).toEqual([["a", 837, 996, "applied"], ["b", 335, 399, "applied"]]);
  });
  it("an interruption AFTER the first update loses nothing: the rerun finishes the rest and keeps every previous value", async () => {
    const t = mk({ a: 837, b: 335 }, { a: 996, b: 399 }); let calls = 0;
    await expect(runCostCorrection(t.deps({ applyUpdate: async (id: string, _from: number, to: number) => { if (++calls === 2) throw new Error("killed"); t.db.set(id, to); return [{ flow_cost_clp: to }]; } }) as never)).rejects.toThrow("killed");
    expect(t.db.get("a")).toBe(996); expect(t.db.get("b")).toBe(335);
    expect(t.manifest().costCorrectionLog!.map((e: Entry) => [e.order, e.from, e.state])).toEqual([["a", 837, "applied"], ["b", 335, "intent"]]);                // the intent survived the crash
    const sum = await runCostCorrection(t.deps() as never);
    expect(sum).toMatchObject({ applied: 1, skipped: 1, conflicts: 0 }); expect(t.db.get("b")).toBe(399);
    expect(t.manifest().costCorrectionLog!.map((e: Entry) => [e.order, e.from, e.to, e.state])).toEqual([["a", 837, 996, "applied"], ["b", 335, 399, "applied"]]);
  });
  it("a crash AFTER the database commit but BEFORE the outcome was recorded is recovered from the intent (the old value is preserved)", async () => {
    const t = mk({ a: 837 }, { a: 996 });
    await expect(runCostCorrection(t.deps({ applyUpdate: async (id: string, _f: number, to: number) => { t.db.set(id, to); throw new Error("killed after commit"); } }) as never)).rejects.toThrow("killed");
    expect(t.db.get("a")).toBe(996); expect(t.manifest().costCorrectionLog![0]).toMatchObject({ from: 837, to: 996, state: "intent" });
    const sum = await runCostCorrection(t.deps() as never);
    expect(sum).toEqual({ applied: 0, recovered: 1, skipped: 0, conflicts: 0 });
    expect(t.manifest().costCorrectionLog![0]).toMatchObject({ from: 837, to: 996, state: "applied", recovered: true });
  });
  it("a concurrent change is a recorded conflict, never overwritten; a finished correction is a no-op on rerun", async () => {
    const t = mk({ a: 837 }, { a: 996 });
    const sum = await runCostCorrection(t.deps({ applyUpdate: async () => [] }) as never);                      // the WHERE no longer matched
    expect(sum).toMatchObject({ applied: 0, conflicts: 1 }); expect(t.manifest().costCorrectionLog![0]).toMatchObject({ state: "conflict", from: 837, to: 996 });
    const u = mk({ a: 837 }, { a: 996 }); await runCostCorrection(u.deps() as never); const before = u.updates();
    expect(await runCostCorrection(u.deps() as never)).toMatchObject({ applied: 0, skipped: 1 }); expect(u.updates()).toBe(before);
    const x = mk({ a: 837 }, { a: 996 }); await expect(runCostCorrection(x.deps({ applyUpdate: async () => { throw new Error("killed"); } }) as never)).rejects.toThrow();
    x.db.set("a", 5000);                                                                                         // someone changed it meanwhile
    expect(await runCostCorrection(x.deps() as never)).toMatchObject({ conflicts: 1 }); expect(x.db.get("a")).toBe(5000);
  });
  it("an unresolved conflict blocks the order on every rerun (the foreign value is kept) until a person resolves it explicitly", async () => {
    const t = mk({ a: 837 }, { a: 996 });
    await expect(runCostCorrection(t.deps({ applyUpdate: async () => { throw new Error("killed"); } }) as never)).rejects.toThrow();
    t.db.set("a", 5000);
    for (let i = 0; i < 3; i++) { expect(await runCostCorrection(t.deps() as never)).toMatchObject({ applied: 0, conflicts: 1 }); expect(t.db.get("a")).toBe(5000); }
    expect(t.manifest().costCorrectionLog!).toHaveLength(1); expect(t.manifest().costCorrectionLog![0]).toMatchObject({ state: "conflict", from: 837, to: 996, found: 5000 });
    const m = t.manifest(); m.costCorrectionLog![0].resolvedAt = "T2"; await t.deps().save(m);                    // explicit resolution
    expect(await runCostCorrection(t.deps() as never)).toMatchObject({ applied: 1 }); expect(t.db.get("a")).toBe(996);
    expect(t.manifest().costCorrectionLog!.map((e: Entry) => [e.from, e.to, e.state])).toEqual([[837, 996, "conflict"], [5000, 996, "applied"]]);
  });
});

describe("remote Sandbox tooling: drift, concurrency and stale closure (Codex round 5)", () => {
  const mk = (cost: number, target: number) => {
    const db = { cost }; let manifest: { costCorrectionLog?: Entry[] } = {}; let n = 0;
    const deps = (over: Record<string, unknown> = {}) => ({
      rows: [{ id: "a", cost: db.cost }], getCost: async () => target, readCost: async () => db.cost, newId: () => "id" + ++n,
      applyUpdate: async (_id: string, from: number | null, to: number) => { await new Promise((r) => setTimeout(r, 15)); if (db.cost !== from) return []; db.cost = to; return [{ flow_cost_clp: to }]; },
      load: async () => structuredClone(manifest), save: async (m: typeof manifest) => { manifest = structuredClone(m); }, now: () => "T", ...over,
    });
    return { db, deps, manifest: () => manifest };
  };
  it("a change AFTER a completed correction is a recorded drift conflict, never overwritten, on every rerun", async () => {
    const t = mk(837, 996); await runCostCorrection(t.deps() as never); expect(t.db.cost).toBe(996);
    t.db.cost = 5000;
    for (let i = 0; i < 3; i++) { expect(await runCostCorrection(t.deps() as never)).toMatchObject({ applied: 0, conflicts: 1 }); expect(t.db.cost).toBe(5000); }
    const log = t.manifest().costCorrectionLog!; expect(log).toHaveLength(2);
    expect(log[1]).toMatchObject({ kind: "drift", state: "conflict", from: 996, found: 5000 });
    log[1].resolvedAt = "T2"; await t.deps().save(t.manifest());                                                  // explicit resolution
    expect(await runCostCorrection(t.deps() as never)).toMatchObject({ applied: 1 }); expect(t.db.cost).toBe(996);
  });
  it("two simultaneous runs: the second is refused by the exclusive lock; the database and the history stay coherent (unique intent ids)", async () => {
    const t = mk(837, 996); const lock = memoryLock();
    const out = await Promise.allSettled([runCostCorrection(t.deps({ lock }) as never), runCostCorrection(t.deps({ lock }) as never)]);
    expect(out.map((o) => o.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect(t.db.cost).toBe(996);
    const log = t.manifest().costCorrectionLog!; expect(log).toHaveLength(1); expect(log[0]).toMatchObject({ id: "id1", from: 837, to: 996, state: "applied" });
    expect(await runCostCorrection(t.deps({ lock }) as never)).toMatchObject({ skipped: 1 });                       // the lock is released afterwards
  });
  it("a failing run releases the lock", async () => {
    const t = mk(837, 996); const lock = memoryLock();
    await expect(runCostCorrection(t.deps({ lock, applyUpdate: async () => { throw new Error("killed"); } }) as never)).rejects.toThrow("killed");
    await expect(runCostCorrection(t.deps({ lock }) as never)).resolves.toMatchObject({ applied: 1 });
  });
  it("a closure followed by a failed query or a late payment is invalidated and kept as history; closing again is explicit", () => {
    const open = { commerceOrder: "a", state: "created", reconciliation: { open: true, problem: "query_failed" } };
    const m: Parameters<typeof applyClosure>[0] & { externalOrders: unknown[] } = { retainedAt: "R", state: "closed-retained", closedAt: "C1", externalOrders: [{ commerceOrder: "a", state: "created", reconciliation: { open: false, flowState: "rejected" } }] };
    expect(applyClosure(m, "T1")).toBe("closed-retained"); expect(m.closedAt).toBe("C1");                           // still clean: untouched
    m.externalOrders[0] = open;                                                                                      // a new failed reconciliation
    expect(applyClosure(m, "T2")).toBe("retained-closure-pending");
    expect(m).toMatchObject({ state: "retained-closure-pending" }); expect(m.closedAt).toBeUndefined();
    expect(m.closureHistory).toEqual([{ closedAt: "C1", invalidatedAt: "T2", reason: "open_issues_reappeared" }]);
    m.externalOrders[0] = { commerceOrder: "a", state: "created", reconciliation: { open: true, problem: "paid_outside_fixo" } };    // late payment
    expect(applyClosure(m, "T3")).toBe("retained-closure-pending"); expect(m.state).toBe("retained-closure-pending");
    m.externalOrders[0] = { commerceOrder: "a", state: "created", reconciliation: { open: false, flowState: "rejected" } };
    expect(applyClosure(m, "T4")).toBe("closed-retained"); expect(m.state).toBe("retained-closure-pending");       // reconciling alone never closes
    expect(applyClosure(m, "T5", { closing: true })).toBe("closed-retained"); expect(m).toMatchObject({ state: "closed-retained", closedAt: "T5" });
    m.externalOrders[0] = open; expect(applyClosure(m, "T6", { closing: true })).toBe("retained-closure-pending");     // explicit close with issues: no closedAt
    expect(m.closedAt).toBeUndefined(); expect(m.closureHistory).toHaveLength(2);
  });
});

describe("remote Sandbox tooling: the REAL manifest lock covers every writer (Codex round 6)", () => {
  const dir = mkdtempSync(join(tmpdir(), "fixo-manifest-")); const file = join(dir, "manifest.json");
  beforeEach(() => { process.env.FIXO_FLOW_SANDBOX_MANIFEST = file; writeFileSync(file, JSON.stringify({ notes: [] })); });
  afterAll(() => { delete process.env.FIXO_FLOW_SANDBOX_MANIFEST; rmSync(dir, { recursive: true, force: true }); });
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  it("writing without holding the lock is refused (a stale copy can never be saved)", async () => {
    const stale = await readManifest(); await expect(writeManifest(stale)).rejects.toThrow(/bloqueo/);
    expect(existsSync(file + ".lock")).toBe(false);
  });
  const correction = (hold: number) => {
    let db = 837; let entered!: () => void; const inside = new Promise<void>((r) => { entered = r; });
    const run = () => withManifestLock(() => runCostCorrection({
      rows: [{ id: "a", cost: db }], getCost: async () => 996, readCost: async () => db,
      applyUpdate: async (_id: string, _f: number | null, to: number) => { entered(); await sleep(hold); db = to; return [{ flow_cost_clp: to }]; },
      load: readManifest, save: writeManifest,
    } as never));
    return { run, inside, db: () => db };
  };
  it("a second writer (another async flow) cannot overwrite a correction in flight: with no wait it is refused, the intent and the outcome survive", async () => {
    const c = correction(40); const running = c.run(); await c.inside;                                              // the correction holds the lock mid-update
    const foreign = await updateManifest((m: { notes: string[] }) => { m.notes = ["escritor ajeno con copia anterior"]; }, { waitMs: 0 }).catch((e: Error) => e);
    expect(String(foreign)).toMatch(/bloqueado/);                                                                  // refused by the real lock
    expect(await running).toMatchObject({ applied: 1, conflicts: 0 }); expect(c.db()).toBe(996);
    const m = await readManifest(); expect(m.costCorrectionLog).toHaveLength(1); expect(m.costCorrectionLog[0]).toMatchObject({ state: "applied", from: 837, to: 996 });
    expect(m.notes).toEqual([]); expect(existsSync(file + ".lock")).toBe(false);                                   // the foreign write never happened
  });
  it("a waiting writer is serialized after the correction: both changes survive (no lost update)", async () => {
    const c = correction(60); const running = c.run(); await c.inside;
    const waiting = updateManifest((m: { notes: string[] }) => { m.notes.push("después"); });                      // waits for the lock
    await running; await waiting;
    const m = await readManifest(); expect(m.costCorrectionLog[0]).toMatchObject({ state: "applied", to: 996 }); expect(m.notes).toEqual(["después"]);
  });
  it("the lock is released after an error and a stale lock file is reported with its path", async () => {
    await expect(updateManifest(() => { throw new Error("boom"); })).rejects.toThrow("boom"); expect(existsSync(file + ".lock")).toBe(false);
    writeFileSync(file + ".lock", "{}"); await expect(updateManifest(() => undefined, { waitMs: 0 })).rejects.toThrow(/manifest\.json\.lock/);
    rmSync(file + ".lock");
  });
});
