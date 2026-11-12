import { describe, it, expect, vi } from "vitest";
import { createHmac } from "node:crypto";
vi.mock("server-only", () => ({}));
import { flowSignature } from "./flow-signature";
import { loadFlowConfig } from "./flow-config";
import { mapFlowStatus } from "./flow-status";
import { FlowClient, FlowProviderError, type FlowFetch } from "./flow-client";

const env = { FIXO_FLOW_MODE: "sandbox", FLOW_API_KEY: "KEY", FLOW_SECRET_KEY: "SECRET", FIXO_FLOW_CALLBACK_ORIGIN: "https://fixo.example" };
const config = () => { const c = loadFlowConfig(env); if (c.mode !== "sandbox") throw new Error("x"); return c; };
const reply = (status: number, body: unknown): FlowFetch => async () => ({ status, text: async () => (typeof body === "string" ? body : JSON.stringify(body)) });

describe("flowSignature", () => {
  it("sorts by name, concatenates name+value raw and ignores s", () => {
    const expected = createHmac("sha256", "SECRET").update("amount1000apiKeyKEYsubjectCafé ñ", "utf8").digest("hex");
    expect(flowSignature({ subject: "Café ñ", apiKey: "KEY", amount: "1000", s: "ignored" }, "SECRET")).toBe(expected);
  });
  it("handles empty values and rejects an empty secret", () => {
    expect(flowSignature({ a: "", b: "x" }, "k")).toBe(createHmac("sha256", "k").update("abx").digest("hex"));
    expect(() => flowSignature({ a: "1" }, "")).toThrow();
  });
});

describe("loadFlowConfig", () => {
  it("is disabled by default and rejects unknown modes", () => {
    expect(loadFlowConfig({})).toEqual({ mode: "disabled" });
    expect(() => loadFlowConfig({ FIXO_FLOW_MODE: "production" })).toThrow();
  });
  it("requires credentials and an HTTPS origin without path", () => {
    expect(() => loadFlowConfig({ ...env, FLOW_SECRET_KEY: "" })).toThrow();
    for (const origin of ["http://fixo.example", "https://fixo.example/x", "https://u:p@fixo.example", "nope", ""]) expect(() => loadFlowConfig({ ...env, FIXO_FLOW_CALLBACK_ORIGIN: origin })).toThrow();
    expect(config().apiBase).toBe("https://sandbox.flow.cl/api");
  });
});

describe("mapFlowStatus", () => {
  it("maps official states and leaves unknown ones unmapped", () => {
    expect([1, 2, 3, 4].map(mapFlowStatus)).toEqual(["pending", "paid", "failed", "cancelled"]);
    expect(mapFlowStatus(5)).toBeNull(); expect(mapFlowStatus(0)).toBeNull();
  });
});

describe("FlowClient", () => {
  const input = { commerceOrder: "fixo-sandbox-1", subject: "Visita", amountClp: 105000, email: "c@example.com", confirmationPath: "/api/payments/flow/confirmation", returnPath: "/api/payments/flow/return" };

  it("signs create and builds the checkout URL from the exact sandbox host", async () => {
    let sent = "";
    const fetcher: FlowFetch = async (_u, init) => { sent = init.body ?? ""; return { status: 200, text: async () => JSON.stringify({ url: "https://sandbox.flow.cl/app/web/pay.php", token: "TK 1", flowOrder: 77 }) }; };
    const res = await new FlowClient(config(), fetcher).createPayment(input);
    expect(res).toEqual({ flowOrder: 77, token: "TK 1", checkoutUrl: "https://sandbox.flow.cl/app/web/pay.php?token=TK%201" });
    const p = new URLSearchParams(sent); const s = p.get("s")!; p.delete("s");
    expect(flowSignature(Object.fromEntries(p), "SECRET")).toBe(s);
    expect(p.get("amount")).toBe("105000"); expect(p.get("urlConfirmation")).toBe("https://fixo.example/api/payments/flow/confirmation");
    expect(sent).not.toContain("SECRET");
  });

  it("rejects checkout destinations other than the sandbox host", async () => {
    for (const url of ["https://evil.example/pay", "http://sandbox.flow.cl/pay", "https://sandbox.flow.cl.evil.example/pay", "https://www.flow.cl/pay", "https://sandbox.flow.cl:8443/pay", "javascript:alert(1)"])
      await expect(new FlowClient(config(), reply(200, { url, token: "t", flowOrder: 1 })).createPayment(input)).rejects.toMatchObject({ code: "unsafe_checkout", ambiguous: true });
  });

  it("treats timeouts, network errors, 5xx and malformed bodies as ambiguous, 4xx as definitive", async () => {
    const hang: FlowFetch = (_u, init) => new Promise((_r, rej) => init.signal.addEventListener("abort", () => rej(new Error("aborted"))));
    const timeout = await new FlowClient(config(), hang, 5).createPayment(input).catch((e) => e);
    expect(timeout).toBeInstanceOf(FlowProviderError); expect(timeout).toMatchObject({ code: "timeout", ambiguous: true });
    const net = await new FlowClient(config(), async () => { throw new Error("boom"); }).createPayment(input).catch((e) => e);
    expect(net).toMatchObject({ code: "network", ambiguous: true });
    expect(await new FlowClient(config(), reply(502, "")).createPayment(input).catch((e) => e)).toMatchObject({ ambiguous: true });
    expect(await new FlowClient(config(), reply(200, "<html>")).createPayment(input).catch((e) => e)).toMatchObject({ code: "invalid_response", ambiguous: true });
    expect(await new FlowClient(config(), reply(200, { url: "x" })).createPayment(input).catch((e) => e)).toMatchObject({ code: "invalid_response" });
    expect(await new FlowClient(config(), reply(400, { message: "bad" })).createPayment(input).catch((e) => e)).toMatchObject({ code: "http_error", ambiguous: false });
    expect(await new FlowClient(config(), reply(401, {})).createPayment(input).catch((e) => e)).toMatchObject({ code: "http_error", ambiguous: false });
  });

  it("only the documented 400/401 are definitive; any other HTTP status stays ambiguous", async () => {
    for (const status of [301, 302, 402, 403, 404, 408, 409, 418, 422, 429, 499, 500, 503]) {
      expect(await new FlowClient(config(), reply(status, {})).createPayment(input).catch((e) => e)).toMatchObject({ code: "http_error", httpStatus: status, ambiguous: true });
    }
  });

  it("never leaks secrets or bodies in errors", async () => {
    const err = await new FlowClient(config(), reply(401, { secret: "SECRET", token: "TK" })).createPayment(input).catch((e) => e);
    expect(JSON.stringify(err) + err.message).not.toMatch(/SECRET|TK/);
  });

  it("parses signed status queries and maps states, fee and exact amount", async () => {
    let url = "";
    const fetcher: FlowFetch = async (u) => { url = u; return { status: 200, text: async () => JSON.stringify({ flowOrder: 9, commerceOrder: "fixo-sandbox-1", status: 2, currency: "CLP", amount: "105000", paymentData: { fee: 4200 } }) }; };
    const obs = await new FlowClient(config(), fetcher).getStatusByCommerceId("fixo-sandbox-1");
    expect(obs).toEqual({ flowOrder: 9, commerceOrder: "fixo-sandbox-1", statusCode: 2, status: "paid", currency: "CLP", amountClp: 105000, feeClp: 4200 });
    const q = new URL(url).searchParams; const s = q.get("s")!; q.delete("s");
    expect(new URL(url).pathname).toBe("/api/payment/getStatusByCommerceId"); expect(flowSignature(Object.fromEntries(q), "SECRET")).toBe(s);
  });

  it("keeps unknown status codes unmapped, fee null when absent and rejects fractional amounts", async () => {
    const base = { flowOrder: 9, commerceOrder: "c", currency: "CLP" };
    expect(await new FlowClient(config(), reply(200, { ...base, status: 7, amount: 10 })).getStatusByFlowOrder(9)).toMatchObject({ status: null, statusCode: 7, feeClp: null });
    await expect(new FlowClient(config(), reply(200, { ...base, status: 2, amount: 10.5 })).getStatusByToken("t")).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("an invalid or non-numeric fee never becomes a confirmed zero", async () => {
    const base = { flowOrder: 9, commerceOrder: "c", status: 2, currency: "CLP", amount: 100 };
    const fee = async (value: unknown) => (await new FlowClient(config(), reply(200, { ...base, paymentData: { fee: value } })).getStatusByToken("t")).feeClp;
    for (const bad of ["", " ", false, true, null, "abc", "1e3", "-5", -5, 4.5, "4.5", [], {}, "0x10"]) expect(await fee(bad)).toBeNull();
    expect(await new FlowClient(config(), reply(200, base)).getStatusByToken("t")).toMatchObject({ feeClp: null });
    expect(await new FlowClient(config(), reply(200, { ...base, paymentData: null })).getStatusByToken("t")).toMatchObject({ feeClp: null });
    expect(await fee(0)).toBe(0); expect(await fee("0")).toBe(0); expect(await fee(551)).toBe(551); expect(await fee("551")).toBe(551);
  });
  it("amount, flowOrder and status are never coerced from empty or boolean values", async () => {
    const base = { flowOrder: 9, commerceOrder: "c", status: 2, currency: "CLP", amount: 100 };
    for (const patch of [{ amount: "" }, { amount: false }, { amount: null }, { amount: "1e2" }, { flowOrder: "" }, { flowOrder: false }, { flowOrder: 0 }, { status: "" }, { status: false }])
      await expect(new FlowClient(config(), reply(200, { ...base, ...patch })).getStatusByToken("t")).rejects.toMatchObject({ code: "invalid_response" });
    expect(await new FlowClient(config(), reply(200, { ...base, amount: "100", flowOrder: "9", status: "2" })).getStatusByToken("t")).toMatchObject({ amountClp: 100, flowOrder: 9, status: "paid" });
  });
});
