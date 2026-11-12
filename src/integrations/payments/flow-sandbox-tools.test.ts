import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { assertAllowedPayer, buildRetireCriterionSql, classifyCreate, classifyReconciliation, flowCost, openExternalIssues } from "../../../scripts/flow-sandbox/logic.mjs";

const OWNER = "owner.test@gmail.com";

describe("remote Sandbox tooling: payer address filter", () => {
  it("accepts only the configured address or a well-formed synthetic .invalid address", () => {
    expect(assertAllowedPayer("Owner.Test@Gmail.com", OWNER)).toBe(OWNER);
    expect(assertAllowedPayer("s05f601d9e-customer@sandbox.fixo.invalid", OWNER)).toBe("s05f601d9e-customer@sandbox.fixo.invalid");
    expect(assertAllowedPayer("a@b.invalid", undefined)).toBe("a@b.invalid");           // synthetic needs no configuration
  });
  it("refuses third parties of any domain, even when something else is configured", () => {
    for (const third of ["outsider@example.org", "prueba@gmail.com", "someone@yahoo.com", "x@soyfixo.cl", "owner.test@gmail.com.evil.com", "a@b.invalid.evil.com", "x@.invalid", "@b.invalid", "a b@c.invalid", "real.customer@gmail.com"]) {
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
