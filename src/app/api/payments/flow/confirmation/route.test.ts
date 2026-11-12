import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomBytes } from "node:crypto";
import type * as CallbackService from "@/services/payments/flow-callback-service";
vi.mock("server-only", () => ({}));
vi.mock("@/repositories/repository-factory", () => ({ getPaymentInboxRepository: () => { throw new Error("unused"); }, getPaymentRateLimiter: () => { throw new Error("unused"); } }));

const state = vi.hoisted(() => ({ hit: undefined as unknown as (...a: unknown[]) => Promise<{ allowed: boolean; retryAfterSeconds: number }>, subjects: [] as string[], received: [] as string[], enabled: true, receive: undefined as undefined | (() => Promise<string>) }));
vi.mock("@/services/payments/flow-callback-service", async (orig) => {
  const actual = await orig<typeof CallbackService>(); const key = { id: "k", key: randomBytes(32) };
  return { ...actual, getFlowCallbackDeps: () => ({
    inbox: { receive: async (hash: string) => { if (state.receive) return state.receive(); state.received.push(hash); return "id"; } }, tokenKey: () => key, assertTarget: () => {}, receiveEnabled: () => state.enabled,
    rateLimiter: { hit: async (...a: unknown[]) => { state.subjects.push(String(a[1])); return state.hit(...a); } },
  }) };
});
import { POST } from "./route";
import { handleConfirmation } from "@/services/payments/flow-callback-handler";

const req = (body: string, headers: Record<string, string> = {}) => new Request("https://app.example.invalid/api/payments/flow/confirmation", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", ...headers }, body });
beforeEach(() => { state.hit = async () => ({ allowed: true, retryAfterSeconds: 0 }); state.subjects = []; state.received = []; state.enabled = true; state.receive = undefined; delete process.env.FIXO_TRUSTED_IP_HEADER; });

describe("confirmation route security", () => {
  it("429 with Retry-After when over the limit and nothing is persisted", async () => {
    state.hit = async () => ({ allowed: false, retryAfterSeconds: 33 });
    const res = await POST(req("token=T1")); expect(res.status).toBe(429); expect(res.headers.get("retry-after")).toBe("33"); expect(state.received).toHaveLength(0);
  });
  it("notifications switch off => 503, never 200, nothing persisted", async () => {
    state.enabled = false; const res = await POST(req("token=T1")); expect(res.status).toBe(503); expect(state.received).toHaveLength(0);
  });
  it("a spoofed X-Forwarded-For cannot choose the rate-limit subject (shared bucket unless a trusted header is configured)", async () => {
    await POST(req("token=T1", { "x-forwarded-for": "9.9.9.9" })); await POST(req("token=T2", { "x-forwarded-for": "8.8.8.8" }));
    expect(state.subjects).toEqual(["ip:unknown", "ip:unknown"]);
    process.env.FIXO_TRUSTED_IP_HEADER = "x-vercel-forwarded-for"; await POST(req("token=T3", { "x-vercel-forwarded-for": "203.0.113.5", "x-forwarded-for": "9.9.9.9" }));
    expect(state.subjects[2]).toMatch(/^ip:[0-9a-f]{32}$/);
  });
  it("repeated identical notifications are accepted with one stable hash (DB generation dedup, no extra payment) and invalid ones never hit the limiter", async () => {
    for (let i = 0; i < 3; i++) expect((await POST(req("token=SAME"))).status).toBe(200);
    expect(new Set(state.received).size).toBe(1);
    const hits = state.subjects.length; expect((await POST(req("status=2"))).status).toBe(400); expect(state.subjects.length).toBe(hits);
  });
});

describe("confirmation total deadline (PLAN 7.2: answer in < 15 s, never an early 200)", () => {
  const never = () => new Promise<never>(() => undefined);
  const streamRequest = (start: (c: ReadableStreamDefaultController<Uint8Array>) => void) => new Request("https://app.example.invalid/api/payments/flow/confirmation", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new ReadableStream<Uint8Array>({ start }), duplex: "half",
  } as RequestInit);
  const timed = async (run: () => Promise<Response>) => { const t0 = Date.now(); const res = await run(); return { res, ms: Date.now() - t0 }; };

  it("a body stream that never finishes is cut at the budget with 408 (no 200, no persistence)", async () => {
    const { res, ms } = await timed(() => handleConfirmation(streamRequest((c) => c.enqueue(new TextEncoder().encode("token=AB"))), 80));
    expect(res.status).toBe(408); expect(ms).toBeLessThan(1000); expect(state.received).toHaveLength(0); expect(state.subjects).toHaveLength(0);
  });
  it("an aborted/errored body stream is a controlled 400, never a thrown error or 200", async () => {
    const res = await handleConfirmation(streamRequest((c) => { c.enqueue(new TextEncoder().encode("token=A")); c.error(new Error("client aborted")); }), 500);
    expect(res.status).toBe(400); expect(state.received).toHaveLength(0);
  });
  it("a limiter RPC that never answers is bounded: 503, inbox untouched, fail-closed", async () => {
    state.hit = never;
    const { res, ms } = await timed(() => handleConfirmation(req("token=T1"), 80));
    expect(res.status).toBe(503); expect(ms).toBeLessThan(1000); expect(state.received).toHaveLength(0);
  });
  it("an inbox RPC that never answers is bounded: 503, never an early 200", async () => {
    state.receive = never;
    const { res, ms } = await timed(() => handleConfirmation(req("token=T1"), 80));
    expect(res.status).toBe(503); expect(ms).toBeLessThan(1000);
  });
  it("an inbox write that completes only AFTER the budget cannot be credited as 200", async () => {
    state.receive = () => new Promise((resolve) => setTimeout(() => resolve("late"), 200));
    expect((await handleConfirmation(req("token=T1"), 60)).status).toBe(503);
  });
  it("inside the budget the happy path still answers 200 only after persistence", async () => {
    expect((await handleConfirmation(req("token=T1"), 1000)).status).toBe(200); expect(state.received).toHaveLength(1);
  });
});
