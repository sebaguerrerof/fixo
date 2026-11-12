import { describe, it, expect, vi } from "vitest";
import { createHash, randomBytes } from "node:crypto";
vi.mock("server-only", () => ({}));
vi.mock("@/repositories/repository-factory", () => ({ getPaymentInboxRepository: () => { throw new Error("unused"); } }));
vi.mock("@/config/auth-origin", () => ({ getAuthOrigin: () => "https://app.example.invalid" }));
import { MAX_CALLBACK_BODY_BYTES, parseCallbackToken, receiveFlowNotification, receiveFlowNotificationDetailed, type FlowCallbackDeps } from "./flow-callback-service";
import { decryptToken } from "@/integrations/payments/token-crypto";
import { POST as confirmation } from "@/app/api/payments/flow/confirmation/route";
import { POST as flowReturn } from "@/app/api/payments/flow/return/route";

const key = { id: "k1", key: randomBytes(32) };
function setup(over: Partial<FlowCallbackDeps> = {}) {
  const received: { hash: string; ciphertext: Buffer; keyId: string }[] = [];
  const deps: FlowCallbackDeps = {
    inbox: { receive: async (hash, ciphertext, keyId) => { received.push({ hash, ciphertext, keyId }); return "inbox-1"; } },
    tokenKey: () => key, assertTarget: () => {}, receiveEnabled: () => true, rateLimiter: { hit: async () => ({ allowed: true, retryAfterSeconds: 0 }) }, ...over,
  };
  return { deps, received };
}

describe("Flow confirmation trigger", () => {
  it("accepts exactly one well-formed token and ignores every other field (status/amount are never trusted)", async () => {
    expect(parseCallbackToken("token=ABC123def")).toBe("ABC123def");
    expect(parseCallbackToken("token=ABC&status=2&amount=1")).toBe("ABC");
    for (const bad of ["", "token=", "status=2", "token=a&token=b", "token=a b", "token=%00", "token=" + "x".repeat(257), "x=" + "a".repeat(MAX_CALLBACK_BODY_BYTES)]) expect(parseCallbackToken(bad)).toBeNull();
  });

  it("persists hash + authenticated ciphertext (the token is never stored in clear) and reports accepted only after persistence", async () => {
    const { deps, received } = setup();
    expect(await receiveFlowNotification("token=SECRETTOKEN1", deps, "ip:test")).toBe("accepted");
    expect(received).toHaveLength(1);
    expect(received[0].hash).toBe(createHash("sha256").update("SECRETTOKEN1").digest("hex"));
    expect(received[0].ciphertext.toString("utf8")).not.toContain("SECRETTOKEN1");
    expect(decryptToken(received[0].ciphertext, "k1", received[0].hash, key)).toBe("SECRETTOKEN1");
    expect(() => decryptToken(received[0].ciphertext, "k1", "other-context", key)).toThrow();
  });

  it("a persistence failure, missing key, unauthorized target or disabled mode is never accepted (so never answered with 200)", async () => {
    const attempts: Partial<FlowCallbackDeps>[] = [
      { inbox: { receive: async () => { throw new Error("db down"); } } }, { tokenKey: () => { throw new Error("no key"); } },
      { assertTarget: () => { throw new Error("wrong project"); } }, { receiveEnabled: () => false },
    ];
    for (const over of attempts) { const { deps, received } = setup(over); expect(await receiveFlowNotification("token=T1", deps, "ip:test")).toBe("unavailable"); expect(received).toHaveLength(0); }
  });

  it("rate limited => 429 outcome, nothing persisted; limiter failure never yields accepted; limit keyed by the server-chosen subject", async () => {
    const hit = vi.fn(async () => ({ allowed: false, retryAfterSeconds: 17 }));
    const a = setup({ rateLimiter: { hit } }); expect(await receiveFlowNotificationDetailed("token=T1", a.deps, "ip:abc")).toEqual({ outcome: "rate_limited", retryAfterSeconds: 17 });
    expect(a.received).toHaveLength(0); expect(hit).toHaveBeenCalledWith("callback_ip", "ip:abc", 120, 60);
    const b = setup({ rateLimiter: { hit: async () => { throw new Error("db down"); } } });
    expect((await receiveFlowNotificationDetailed("token=T1", b.deps, "ip:abc")).outcome).toBe("unavailable"); expect(b.received).toHaveLength(0);
  });

  it("duplicate notifications for the same token are all accepted but always map to the same hash (DB dedups by generation: no second payment)", async () => {
    const { deps, received } = setup();
    for (let i = 0; i < 3; i++) expect(await receiveFlowNotification("token=SAMETOKEN", deps, "ip:x")).toBe("accepted");
    expect(new Set(received.map((r) => r.hash)).size).toBe(1); expect(received).toHaveLength(3);
  });

  it("an invalid body is rejected without touching the inbox or the limiter", async () => {
    const hit = vi.fn(); const { deps } = setup({ rateLimiter: { hit } });
    expect(await receiveFlowNotification("status=2", deps, "ip:x")).toBe("rejected"); expect(hit).not.toHaveBeenCalled();
  });

  it("an invalid body is rejected without touching the inbox", async () => {
    const { deps, received } = setup(); expect(await receiveFlowNotification("status=2", deps, "ip:test")).toBe("rejected"); expect(received).toHaveLength(0);
  });
});

describe("Flow routes", () => {
  const post = (body: string, type = "application/x-www-form-urlencoded") => new Request("https://app.example.invalid/api/payments/flow/confirmation", { method: "POST", headers: { "content-type": type }, body });
  it("confirmation: wrong content type 415, oversized or empty 400, never 200 when the notification cannot be recorded", async () => {
    expect((await confirmation(post("token=A", "application/json"))).status).toBe(415);
    expect((await confirmation(post("token=" + "a".repeat(MAX_CALLBACK_BODY_BYTES + 1)))).status).toBe(400);
    expect((await confirmation(post("status=2"))).status).toBe(400);
    const res = await confirmation(post("token=A")); // demo mode in tests: repositories unavailable => nothing persisted
    expect(res.status).toBe(503); expect(res.headers.get("cache-control")).toBe("no-store");
  });
  it("return: 303 to a stable internal page, no token or state in the redirect, no-store", async () => {
    const res = await flowReturn();
    expect(res.status).toBe(303); expect(res.headers.get("location")).toBe("https://app.example.invalid/cliente/trabajos");
    expect(res.headers.get("cache-control")).toBe("no-store"); expect(res.headers.get("referrer-policy")).toBe("no-referrer");
  });
});
