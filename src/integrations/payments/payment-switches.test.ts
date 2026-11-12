import { describe, it, expect } from "vitest";
import { loadPaymentSwitches } from "./payment-switches";
import { rateLimitSubjectForRequest } from "./trusted-client-ip";

describe("payment switches", () => {
  it("both are disabled by default and FIXO_FLOW_MODE alone enables nothing", () => {
    expect(loadPaymentSwitches({})).toEqual({ creationEnabled: false, notificationsEnabled: false });
    expect(loadPaymentSwitches({ FIXO_FLOW_MODE: "sandbox" })).toEqual({ creationEnabled: false, notificationsEnabled: false });
  });
  it("only the literal true enables each switch, independently", () => {
    expect(loadPaymentSwitches({ FIXO_PAYMENTS_CREATION_ENABLED: "true" })).toEqual({ creationEnabled: true, notificationsEnabled: false });
    expect(loadPaymentSwitches({ FIXO_PAYMENTS_NOTIFICATIONS_ENABLED: " true " })).toEqual({ creationEnabled: false, notificationsEnabled: true });
    for (const v of ["", "1", "TRUE", "yes", "on", "false"]) expect(loadPaymentSwitches({ FIXO_PAYMENTS_CREATION_ENABLED: v, FIXO_PAYMENTS_NOTIFICATIONS_ENABLED: v })).toEqual({ creationEnabled: false, notificationsEnabled: false });
  });
});

describe("rate limit subject", () => {
  const h = (o: Record<string, string>) => new Headers(o);
  it("ignores client-controlled headers unless the trusted header is configured (shared strict bucket, fails closed)", () => {
    expect(rateLimitSubjectForRequest(h({ "x-forwarded-for": "1.2.3.4", "x-real-ip": "1.2.3.4" }), {})).toBe("ip:unknown");
    expect(rateLimitSubjectForRequest(h({ "x-forwarded-for": "1.2.3.4" }), { FIXO_TRUSTED_IP_HEADER: "x-vercel-forwarded-for" })).toBe("ip:unknown");
  });
  it("uses only the configured header, hashes the address and never exposes the raw IP", () => {
    const env = { FIXO_TRUSTED_IP_HEADER: "x-vercel-forwarded-for" };
    const a = rateLimitSubjectForRequest(h({ "x-vercel-forwarded-for": "203.0.113.9" }), env), b = rateLimitSubjectForRequest(h({ "x-vercel-forwarded-for": "203.0.113.10" }), env);
    expect(a).toMatch(/^ip:[0-9a-f]{32}$/); expect(a).not.toContain("203.0.113"); expect(a).not.toBe(b);
    expect(rateLimitSubjectForRequest(h({ "x-vercel-forwarded-for": "203.0.113.9" }), env)).toBe(a);
  });
  it("malformed values and bad header names fall back to the shared bucket", () => {
    expect(rateLimitSubjectForRequest(h({ "x-vercel-forwarded-for": "not an ip; drop table" }), { FIXO_TRUSTED_IP_HEADER: "x-vercel-forwarded-for" })).toBe("ip:unknown");
    expect(rateLimitSubjectForRequest(h({ "x-real-ip": "1.2.3.4" }), { FIXO_TRUSTED_IP_HEADER: "bad header!" })).toBe("ip:unknown");
  });
});
