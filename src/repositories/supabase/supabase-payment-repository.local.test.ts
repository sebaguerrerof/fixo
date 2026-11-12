/**
 * Integration against an ISOLATED LOCAL Supabase (Auth + Kong + PostgREST + PostgreSQL). Skipped unless explicitly enabled:
 *   FIXO_PAYMENTS_LOCAL_SUPABASE=isolated-local, FIXO_TEST_SUPABASE_URL (loopback), FIXO_TEST_ANON_KEY,
 *   FIXO_TEST_SERVICE_ROLE_KEY, FIXO_TEST_DB_URL (loopback). Never reads .env.local, never contacts Flow (provider is a test double).
 * Uses the REAL repositories and PaymentService; only the Next.js cookie client and the Flow provider are replaced.
 * Fixtures stay in the disposable local instance (no automatic deletion).
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
// @ts-expect-error pg ships no types and @types/pg is not a project dependency; the minimal shape used here is declared below.
import pg from "pg";
/* eslint-disable @typescript-eslint/no-explicit-any */
type PgClient = { connect(): Promise<void>; query(sql: string, args?: unknown[]): Promise<{ rows: any[] }>; end(): Promise<void> };

const enabled = process.env.FIXO_PAYMENTS_LOCAL_SUPABASE === "isolated-local";
const url = process.env.FIXO_TEST_SUPABASE_URL ?? "", anonKey = process.env.FIXO_TEST_ANON_KEY ?? "", serviceKey = process.env.FIXO_TEST_SERVICE_ROLE_KEY ?? "", dbUrl = process.env.FIXO_TEST_DB_URL ?? "";
const loopback = (v: string) => { try { return ["127.0.0.1", "localhost", "[::1]"].includes(new URL(v).hostname); } catch { return false; } };

// Holders consulted by the mocked clients (the repositories call these on every operation).
const holder: { user: SupabaseClient | null; service: SupabaseClient | null } = { user: null, service: null };
vi.mock("server-only", () => ({}));
vi.mock("@/integrations/supabase/server-client", () => ({ getSupabaseServerClient: async () => { if (!holder.user) throw new Error("no user client"); return holder.user; } }));
vi.mock("@/integrations/supabase/payments-service-client", () => ({ getPaymentsServiceClient: () => { if (!holder.service) throw new Error("no service client"); return holder.service; } }));
vi.mock("@/repositories/repository-factory", () => ({ getPaymentRepository: () => { throw new Error("unused"); }, getPaymentProcessingRepository: () => { throw new Error("unused"); } }));

describe.skipIf(!enabled)("payments through real PostgREST with the real repositories", () => {
  const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
  let db: PgClient, admin: SupabaseClient, anon: SupabaseClient;
  const actors: Record<string, { id: string; client: SupabaseClient }> = {};
  const key = { id: "local-key", key: randomBytes(32) };

  async function makeActor(label: string, type: "customer" | "technician") {
    const email = `s05-${label}-${randomUUID()}@local.invalid`, password = `Local-Only-${randomBytes(12).toString("hex")}9A`;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { first_name: "Synthetic", last_name: label, phone: "+56912345678", terms_accepted: true, account_type: type, category_ids: ["gasfiteria"], coverage_areas: ["Ñuñoa"] } });
    expect(created.error).toBeNull();
    const client = createClient(url, anonKey, opts); const signed = await client.auth.signInWithPassword({ email, password });
    expect(signed.error).toBeNull(); actors[label] = { id: created.data.user!.id, client };
  }
  async function rpc<T = unknown>(label: string, name: string, args: Record<string, unknown>): Promise<T> {
    const r = await actors[label].client.rpc(name, args); expect(r.error, `${name}: ${r.error?.message}`).toBeNull(); return r.data as T;
  }
  const quotePayload = () => ({ laborClp: 20000, materialsClp: 5000, diagnosticClp: 0, description: "Reparación y revisión completa de la fuga indicada.", materialsIncluded: "Sello", materialsNotIncluded: "", diagnosticVisit: false, estimatedDuration: "2 horas", availableDate: new Date(Date.now() + 86400000).toISOString(), conditions: "Solo trabajo descrito", expiresAt: new Date(Date.now() + 172800000).toISOString() });
  async function newJob(): Promise<string> {
    await db.query("update public.service_requests set created_at=now()-interval '3 days' where customer_id=$1", [actors.customerA.id]);
    const r = await rpc<{ id: string }>("customerA", "marketplace_create_request", { operation_id: randomUUID(), payload: { title: "Fuga bajo lavaplatos", categoryId: "gasfiteria", description: "Necesito reparar una fuga de agua bajo el lavaplatos.", locationLabel: "Nunoa", address: "Synthetic private address", reference: "Synthetic reference", preferredSlot: "Mañana", scheduledFor: null } });
    let q = await rpc<{ id: string; revision: number }>("technicianA", "marketplace_save_quote", { request_id: r.id, operation_id: randomUUID(), payload: quotePayload() });
    q = await rpc("technicianA", "marketplace_transition_quote", { quote_id: q.id, next_status: "submitted", expected_revision: q.revision });
    return (await rpc<{ job: { id: string } }>("customerA", "marketplace_accept_quote", { request_id: r.id, quote_id: q.id, expected_revision: q.revision })).job.id;
  }
  const attemptRow = async (id: string) => (await db.query("select state,error_code,flow_order::text fo,encode(checkout_ciphertext,'hex') ct,checkout_key_id from private.payment_attempts where id=$1", [id])).rows[0];
  const mkService = async (provider: unknown, user = "customerA") => {
    holder.user = actors[user].client;
    const { PaymentService } = await import("@/services/payments/payment-service");
    const { SupabasePaymentProcessingRepository, SupabasePaymentRateLimiter, SupabasePaymentRepository } = await import("./supabase-payment-repository");
    return new PaymentService({ repository: new SupabasePaymentRepository(), processing: new SupabasePaymentProcessingRepository(), provider: provider as never, creationEnabled: true, tokenKey: () => key, assertTarget: () => {}, rateLimiter: new SupabasePaymentRateLimiter() });
  };
  const input = (jobId: string) => ({ jobId, extraChargeId: null, expectedPolicyVersion: 1, consent: true as const, idempotencyKey: randomUUID() });

  beforeAll(async () => {
    expect(loopback(url) && loopback(dbUrl) && anonKey && serviceKey, "Sólo destinos loopback con claves locales").toBeTruthy();
    admin = createClient(url, serviceKey, opts); anon = createClient(url, anonKey, opts); holder.service = admin;
    db = new pg.Client({ connectionString: dbUrl }); await db.connect();
    expect((await db.query("select count(*)::int n from auth.users where email not like 's05-%@local.invalid'")).rows[0].n, "instancia con usuarios ajenos").toBe(0);
    for (const [l, t] of [["customerA", "customer"], ["customerB", "customer"], ["technicianA", "technician"], ["admin", "customer"]] as const) await makeActor(l, t);
    await db.query("update public.profiles set role='superadmin' where id=$1", [actors.admin.id]);
    // Sandbox payments need an authorized synthetic account (database-enforced): authorize the suite's customer through the real superadmin RPC.
    await rpc("admin", "payment_sandbox_account_set", { target_user: actors.customerA.id, enabled: true, change_reason: "Cuenta sintética de la prueba de integración local" });
    await (db.query(`insert into private.category_requirements(category_id,requirement_key,version,kind,required,document_type,description,created_by)
      values('gasfiteria',$2,1,'internal',false,'other','Synthetic test criterion',$1) returning id`, [actors.admin.id, `s05-${randomUUID().slice(0, 8)}`]));
    await db.query("update private.technician_applications set state='approved',primary_category='gasfiteria',requirement_snapshot=array(select id from private.category_requirements where active and category_id='gasfiteria' order by id),consent_at=now() where technician_id=$1", [actors.technicianA.id]);
    await db.query("update private.technician_applications set approved_fingerprint=private.professional_fingerprint(technician_id) where technician_id=$1", [actors.technicianA.id]);
    await db.query("update public.technician_profiles set status='active' where user_id=$1", [actors.technicianA.id]);
  }, 120_000);
  afterAll(async () => { await db?.end(); });

  it("reads the policy and runs prepare -> reserve -> store -> reopen with the real repositories (bytea round-trip)", async () => {
    const { decryptToken } = await import("@/integrations/payments/token-crypto");
    const { SupabasePaymentRepository } = await import("./supabase-payment-repository");
    holder.user = actors.customerA.client;
    expect(await new SupabasePaymentRepository().getPolicy()).toEqual({ version: 1, feeBasisPoints: 500 });

    const flowOrder = 1_000_000 + Math.floor(Math.random() * 1_000_000_000); // flow_order is unique: reruns on the same instance must not collide
    const job = await newJob(); const checkoutUrl = "https://sandbox.flow.cl/app/web/pay.php?token=LOCAL-TOKEN";
    const createOrder = vi.fn(async () => ({ flowOrder, token: "LOCAL-TOKEN", checkoutUrl }));
    const service = await mkService({ createOrder });
    const first = await service.startCheckout(input(job), { id: actors.customerA.id, email: "customer@example.com" });
    expect(first).toEqual({ status: "redirect", checkoutUrl, totalClp: 26250 });
    expect(createOrder).toHaveBeenCalledWith(expect.objectContaining({ amountClp: 26250, professionalAmountClp: 25000, platformFeeClp: 1250 }));

    const order = (await db.query("select id from private.payment_orders where job_id=$1", [job])).rows[0].id;
    const attempt = (await db.query("select id from private.payment_attempts where order_id=$1", [order])).rows[0].id;
    const row = await attemptRow(attempt);
    expect(row).toMatchObject({ state: "pending", fo: String(flowOrder), checkout_key_id: "local-key" });
    expect(row.ct).not.toContain(Buffer.from("LOCAL-TOKEN").toString("hex")); // never stored in clear
    expect(decryptToken(Buffer.from(row.ct, "hex"), "local-key", attempt, key)).toBe(checkoutUrl); // exact bytes survived PostgREST

    // New tab / new key / new session of the same customer reuses the live checkout; Flow is not called again.
    const again = await service.startCheckout(input(job), { id: actors.customerA.id, email: "customer@example.com" });
    expect(again).toEqual({ status: "redirect", checkoutUrl, totalClp: 26250 }); expect(createOrder).toHaveBeenCalledTimes(1);
    expect((await db.query("select count(*)::int n from private.payment_attempts where order_id=$1", [order])).rows[0].n).toBe(1);
  }, 120_000);

  it("another customer, a technician and anon are denied through PostgREST; privileged RPCs are not callable by users", async () => {
    const { PaymentForbiddenError, PaymentConflictError } = await import("@/repositories/contracts/payment-repository");
    const { SupabasePaymentProcessingRepository, SupabasePaymentRepository } = await import("./supabase-payment-repository");
    const job = await newJob();
    holder.user = actors.customerB.client;
    await expect(new SupabasePaymentRepository().prepare({ ...input(job) })).rejects.toBeInstanceOf(PaymentForbiddenError);
    holder.user = actors.technicianA.client;
    await expect(new SupabasePaymentRepository().prepare({ ...input(job) })).rejects.toBeInstanceOf(PaymentForbiddenError);
    const anonRes = await anon.rpc("payment_prepare", { target_job: job, target_extra: null, expected_policy_version: 1, consent: true, idempotency_key: randomUUID() });
    expect(anonRes.error?.code).toBe("42501");

    holder.user = actors.customerA.client; const p = await new SupabasePaymentRepository().prepare(input(job));
    const ghost = randomUUID();
    for (const label of ["customerA", "customerB", "technicianA", "admin"]) {
      for (const [fn, args] of [["payment_attempt_begin_create", { target_attempt: p.attemptId }], ["payment_attempt_checkout", { target_attempt: p.attemptId, expected_customer: actors.customerA.id }],
        ["payment_attempt_set_checkout", { target_attempt: p.attemptId, flow_order_id: 1, ciphertext: "\\x00", key_id: "k" }], ["payment_attempt_mark_failed", { target_attempt: p.attemptId, code: "x" }],
        ["payment_inbox_claim", {}], ["payment_apply_observation", { target_attempt: p.attemptId, event_key: "evt-12345678", observed_flow_order: 1, observed_commerce_order: "x", observed_status: 2, observed_amount: 1, observed_currency: "CLP", observed_fee: null, provider_time: new Date().toISOString() }]] as const) {
        const r = await actors[label].client.rpc(fn, args as never); expect(r.error?.code, `${label} -> ${fn}`).toBe("42501");
      }
    }
    expect((await actors.customerA.client.from("payment_orders").select("*")).error).not.toBeNull(); // private schema is not exposed
    holder.service = admin;
    await expect(new SupabasePaymentProcessingRepository().getCheckout(p.attemptId, actors.customerA.id)).rejects.toBeInstanceOf(PaymentConflictError); // still `prepared`: no checkout
    await expect(new SupabasePaymentProcessingRepository().getCheckout(ghost, actors.customerA.id)).rejects.toBeInstanceOf(PaymentConflictError);
  }, 120_000);

  it("inbox round trip with ONLY the fields the claim RPC returns: receive -> persist -> claim -> decrypt (AAD = token_sha256)", async () => {
    const { createHash } = await import("node:crypto");
    const { SupabasePaymentInboxRepository } = await import("./supabase-payment-repository");
    const { encryptToken, decryptToken } = await import("@/integrations/payments/token-crypto");
    const token = "RT-" + randomBytes(12).toString("hex"), hash = createHash("sha256").update(token, "utf8").digest("hex");
    holder.service = admin;
    const sealed = encryptToken(token, hash, key);
    const id = await new SupabasePaymentInboxRepository().receive(hash, sealed.ciphertext, sealed.keyId);
    let claimed: Record<string, unknown> | null = null;
    for (let i = 0; i < 100 && !claimed; i++) { // the local instance may hold rows from other runs: skip them, never touch their state
      const r = await admin.rpc("payment_inbox_claim"); expect(r.error).toBeNull(); if (!r.data) break;
      if ((r.data as { id: string }).id === id) claimed = r.data as Record<string, unknown>;
    }
    expect(claimed, "own inbox row claimed").not.toBeNull();
    const c = claimed as { token_sha256: string; token_ciphertext: string; key_id: string; lease_token: string; generation: number };
    expect(c.token_sha256).toBe(hash); // the context needed to decrypt comes from the RPC, not from the receiver
    expect(decryptToken(Buffer.from(c.token_ciphertext, "base64"), c.key_id, c.token_sha256, key)).toBe(token);
    expect(() => decryptToken(Buffer.from(c.token_ciphertext, "base64"), c.key_id, "wrong-context", key)).toThrow();
    const fin = await admin.rpc("payment_inbox_finish", { inbox_id: id, lease: c.lease_token, outcome: "done", observed_generation: c.generation }); expect(fin.error).toBeNull();
  }, 60_000);

  it("worker end to end: callback -> inbox -> signed-query double -> verified application; duplicates/retries add no payment, no event, no attempt", async () => {
    const { createHash } = await import("node:crypto");
    const { SupabasePaymentInboxRepository, SupabasePaymentWorkerRepository } = await import("./supabase-payment-repository");
    const { runPaymentWorkerBatch } = await import("@/services/payments/payment-worker-service");
    const { encryptToken } = await import("@/integrations/payments/token-crypto");
    const { FlowProviderError } = await import("@/integrations/payments/flow-client");
    const flowOrder = 2_000_000_000 + Math.floor(Math.random() * 100_000_000);
    const job = await newJob(); const token = "WK-" + randomBytes(10).toString("hex");
    const service = await mkService({ createOrder: async () => ({ flowOrder, token, checkoutUrl: `https://sandbox.flow.cl/app/web/pay.php?token=${token}` }) });
    await service.startCheckout(input(job), { id: actors.customerA.id, email: "customer@example.com" });
    const o = (await db.query("select o.id,o.total_clp::int t,a.id attempt,a.commerce_order c from private.payment_orders o join private.payment_attempts a on a.order_id=o.id where o.job_id=$1", [job])).rows[0];
    const paid = { flowOrder, commerceOrder: o.c as string, statusCode: 2, status: "paid" as const, currency: "CLP", amountClp: o.t as number, feeClp: 300 };
    // Only OUR token/order are answered; rows left by other runs on this disposable instance just get a transient failure (retry/backoff).
    const reconcile = vi.fn(async (q: { token?: string; flowOrder?: number; commerceOrder?: string }) => { if (q.token === token || q.flowOrder === flowOrder || q.commerceOrder === o.c) return paid; throw new FlowProviderError("timeout"); });
    holder.service = admin;
    const deps = { repo: new SupabasePaymentWorkerRepository(), provider: { reconcile }, tokenKey: () => key, assertTarget: () => {}, enabled: () => true };
    const hash = createHash("sha256").update(token, "utf8").digest("hex"); const sealed = encryptToken(token, hash, key);
    const inbox = new SupabasePaymentInboxRepository();
    const state = async () => (await db.query("select o.status,o.paid_attempt_id pa,o.flow_cost_clp::int fee,(select count(*)::int from private.payment_events e where e.order_id=o.id) ev,(select count(*)::int from private.payment_attempts x where x.order_id=o.id) att from private.payment_orders o where o.id=$1", [o.id])).rows[0];

    expect((await state()).status).not.toBe("paid");
    await inbox.receive(hash, sealed.ciphertext, sealed.keyId); await runPaymentWorkerBatch(deps, 100);
    const after = await state(); expect(after).toMatchObject({ status: "paid", pa: o.attempt, fee: 300, att: 1 }); expect(after.ev).toBe(1);

    // Duplicate notifications (also while/after processing) and extra passes: no second payment, event or attempt.
    for (let i = 0; i < 3; i++) await inbox.receive(hash, sealed.ciphertext, sealed.keyId);
    await runPaymentWorkerBatch(deps, 100); await runPaymentWorkerBatch(deps, 100);
    expect(await state()).toEqual(after);

    // A notification for a token Flow does not know is never applied (provider refusal => quarantine).
    const bogus = "BOGUS-" + randomBytes(8).toString("hex"), bh = createHash("sha256").update(bogus).digest("hex"), bs = encryptToken(bogus, bh, key);
    const bogusDeps = { ...deps, provider: { reconcile: async (q: { token?: string }) => { if (q.token === bogus) throw new FlowProviderError("http_error", 400); return reconcile(q); } } };
    await inbox.receive(bh, bs.ciphertext, bs.keyId); await runPaymentWorkerBatch(bogusDeps as never, 100);
    expect((await db.query("select state,quarantine_reason from private.payment_inbox where token_sha256=$1", [bh])).rows[0]).toMatchObject({ state: "quarantined", quarantine_reason: "flow_http_error_400" });
    expect(await state()).toEqual(after);
  }, 120_000);

  it("worker correlation: a response naming ANOTHER attempt never touches it (claimed attempt goes to review); unknown identity quarantines the inbox row; provider time stays null", async () => {
    const { createHash } = await import("node:crypto");
    const { SupabasePaymentInboxRepository, SupabasePaymentWorkerRepository } = await import("./supabase-payment-repository");
    const { runPaymentWorkerBatch } = await import("@/services/payments/payment-worker-service");
    const { encryptToken } = await import("@/integrations/payments/token-crypto");
    const { FlowProviderError } = await import("@/integrations/payments/flow-client");
    const mk = async () => {
      const flowOrder = 2_200_000_000 + Math.floor(Math.random() * 90_000_000), token = "CR-" + randomBytes(8).toString("hex"), job = await newJob();
      const svc = await mkService({ createOrder: async () => ({ flowOrder, token, checkoutUrl: `https://sandbox.flow.cl/app/web/pay.php?token=${token}` }) });
      await svc.startCheckout(input(job), { id: actors.customerA.id, email: "customer@example.com" });
      const r = (await db.query("select o.id oid,o.total_clp::int t,a.id aid,a.commerce_order c from private.payment_orders o join private.payment_attempts a on a.order_id=o.id where o.job_id=$1", [job])).rows[0];
      await db.query("update private.payment_attempts set next_check_at=now() where id=$1", [r.aid]);
      return { flowOrder, ...r } as { flowOrder: number; oid: string; t: number; aid: string; c: string };
    };
    const A = await mk(), B = await mk(); holder.service = admin;
    // Asking about A, Flow "answers" with B's identity and exact total (a hostile/buggy response).
    const reconcile = vi.fn(async (q: { flowOrder?: number; token?: string; commerceOrder?: string }) => {
      if (q.flowOrder === A.flowOrder) return { flowOrder: B.flowOrder, commerceOrder: B.c, statusCode: 2, status: "paid" as const, currency: "CLP", amountClp: B.t, feeClp: 300 };
      throw new FlowProviderError("timeout");
    });
    const deps = { repo: new SupabasePaymentWorkerRepository(), provider: { reconcile }, tokenKey: () => key, assertTarget: () => {}, enabled: () => true };
    await runPaymentWorkerBatch(deps, 100);
    expect((await db.query("select status,paid_attempt_id,review_reason from private.payment_orders where id=$1", [B.oid])).rows[0]).toMatchObject({ status: "awaiting_payment", paid_attempt_id: null, review_reason: null });
    expect((await db.query("select count(*)::int n from private.payment_events where order_id=$1", [B.oid])).rows[0].n).toBe(0);
    expect((await db.query("select state from private.payment_attempts where id=$1", [B.aid])).rows[0].state).toBe("pending");
    expect((await db.query("select review_reason from private.payment_orders where id=$1", [A.oid])).rows[0].review_reason).toBe("provider_mismatch");
    expect((await db.query("select state from private.payment_attempts where id=$1", [A.aid])).rows[0].state).toBe("quarantined");
    expect((await db.query("select validation,provider_observed_at from private.payment_events where order_id=$1", [A.oid])).rows).toEqual([{ validation: "mismatch", provider_observed_at: null }]);

    // Order 1: A's mismatch must NOT shadow B's valid payment (same observed facts, different target attempt).
    const dataOf = (X: { flowOrder: number; c: string; t: number }) => ({ flowOrder: X.flowOrder, commerceOrder: X.c, statusCode: 2, status: "paid" as const, currency: "CLP", amountClp: X.t, feeClp: 300 });
    const answering = (fn: (q: { flowOrder?: number; token?: string; commerceOrder?: string }) => unknown) => ({ ...deps, provider: { reconcile: async (q: { flowOrder?: number; token?: string; commerceOrder?: string }) => { const r = fn(q); if (r) return r as never; throw new FlowProviderError("timeout"); } } });
    await db.query("update private.payment_attempts set next_check_at=now() where id=$1", [B.aid]);
    await runPaymentWorkerBatch(answering((q) => q.flowOrder === B.flowOrder ? dataOf(B) : null) as never, 100);
    expect((await db.query("select status,paid_attempt_id,flow_cost_clp::int fee,review_reason from private.payment_orders where id=$1", [B.oid])).rows[0]).toEqual({ status: "paid", paid_attempt_id: B.aid, fee: 300, review_reason: null });
    expect((await db.query("select validation from private.payment_events where order_id=$1", [B.oid])).rows).toEqual([{ validation: "applied" }]);
    expect((await db.query("select review_reason from private.payment_orders where id=$1", [A.oid])).rows[0].review_reason).toBe("provider_mismatch");

    // Order 2: D is paid first, then C is claimed and answered with D's facts: C goes to review (event recorded, not shadowed), D stays paid exactly once.
    const C = await mk(), D = await mk(); holder.service = admin;
    await db.query("update private.payment_attempts set next_check_at=now() where id=$1", [D.aid]);
    await runPaymentWorkerBatch(answering((q) => q.flowOrder === D.flowOrder ? dataOf(D) : null) as never, 100);
    await db.query("update private.payment_attempts set next_check_at=now() where id=$1", [C.aid]);
    await runPaymentWorkerBatch(answering((q) => q.flowOrder === C.flowOrder ? dataOf(D) : null) as never, 100);
    expect((await db.query("select status,paid_attempt_id,review_reason from private.payment_orders where id=$1", [D.oid])).rows[0]).toEqual({ status: "paid", paid_attempt_id: D.aid, review_reason: null });
    expect((await db.query("select validation from private.payment_events where order_id=$1", [D.oid])).rows).toEqual([{ validation: "applied" }]);
    expect((await db.query("select state from private.payment_attempts where id=$1", [C.aid])).rows[0].state).toBe("quarantined");
    expect((await db.query("select status,review_reason from private.payment_orders where id=$1", [C.oid])).rows[0]).toEqual({ status: "awaiting_payment", review_reason: "provider_mismatch" });
    expect((await db.query("select validation from private.payment_events where order_id=$1", [C.oid])).rows).toEqual([{ validation: "mismatch" }]);

    // Unknown identity from a callback token: inbox row is quarantined (counted), the event keeps provider time null.
    const token = "UK-" + randomBytes(8).toString("hex"), hash = createHash("sha256").update(token).digest("hex"), sealed = encryptToken(token, hash, key);
    const unknownFlow = 2_900_000_000 + Math.floor(Math.random() * 90_000_000);
    const unk = { ...deps, provider: { reconcile: async (q: { token?: string }) => { if (q.token === token) return { flowOrder: unknownFlow, commerceOrder: "UNKNOWN-" + unknownFlow, statusCode: 2, status: "paid" as const, currency: "CLP", amountClp: 1000, feeClp: 10 }; return reconcile(q); } } };
    await new SupabasePaymentInboxRepository().receive(hash, sealed.ciphertext, sealed.keyId); await runPaymentWorkerBatch(unk as never, 100);
    expect((await db.query("select state,quarantine_reason from private.payment_inbox where token_sha256=$1", [hash])).rows[0]).toEqual({ state: "quarantined", quarantine_reason: "quarantined_unknown_identity" });
    expect((await db.query("select validation,provider_observed_at from private.payment_events where flow_order=$1", [unknownFlow])).rows).toEqual([{ validation: "unknown_identity", provider_observed_at: null }]);
  }, 180_000);

  it("an ambiguous provider result is persisted through the RPC and blocks another attempt (no recreation)", async () => {
    const { PaymentOutcomeUnknownError } = await import("@/services/payments/payment-service");
    const { PaymentConflictError } = await import("@/repositories/contracts/payment-repository");
    const { FlowProviderError } = await import("@/integrations/payments/flow-client");
    const job = await newJob();
    const service = await mkService({ createOrder: async () => { throw new FlowProviderError("timeout"); } });
    await expect(service.startCheckout(input(job), { id: actors.customerA.id, email: "customer@example.com" })).rejects.toBeInstanceOf(PaymentOutcomeUnknownError);
    const row = (await db.query("select a.id,a.state,a.error_code from private.payment_attempts a join private.payment_orders o on o.id=a.order_id where o.job_id=$1", [job])).rows;
    expect(row).toHaveLength(1); expect(row[0]).toMatchObject({ state: "reconciliation_required", error_code: "timeout" });
    await expect(service.startCheckout(input(job), { id: actors.customerA.id, email: "customer@example.com" })).rejects.toBeInstanceOf(PaymentConflictError);
    expect((await db.query("select count(*)::int n from private.payment_attempts a join private.payment_orders o on o.id=a.order_id where o.job_id=$1", [job])).rows[0].n).toBe(1);
  }, 120_000);

  it("administrative settings through real PostgREST: moderator reads, only superadmin edits; nothing here can impose a payment (policy is not mutated: versions only grow)", async () => {
    await makeActor("moderatorX", "customer"); await makeActor("superX", "customer");
    await db.query("update public.profiles set role='moderator' where id=$1", [actors.moderatorX.id]);
    await db.query("update public.profiles set role='superadmin' where id=$1", [actors.superX.id]);
    const { SupabasePaymentRepository } = await import("./supabase-payment-repository");
    const { PaymentConflictError, PaymentForbiddenError } = await import("@/repositories/contracts/payment-repository");
    const repo = new SupabasePaymentRepository();
    for (const who of ["moderatorX", "superX"]) {
      holder.user = actors[who].client; const ov = await repo.getAdminOverview();
      expect(ov.policy?.version).toBeGreaterThanOrEqual(1); expect(ov.history.length).toBeGreaterThanOrEqual(1); expect(ov.history[0].version).toBe(ov.policy?.version);
      expect(ov.history[ov.history.length - 1].reason.length).toBeGreaterThan(9); expect(Array.isArray(ov.pending)).toBe(true); expect(Array.isArray(ov.reviews)).toBe(true); expect(typeof ov.quarantinedInbox).toBe("number");
    }
    holder.user = actors.moderatorX.client;
    await expect(repo.setPolicy({ expectedVersion: 1, basisPoints: 100, reason: "Moderador sin permiso de edición" })).rejects.toBeInstanceOf(PaymentForbiddenError);
    await expect(repo.requestReconciliation(randomUUID())).rejects.toBeInstanceOf(PaymentForbiddenError);
    holder.user = actors.customerA.client; await expect(repo.getAdminOverview()).rejects.toBeInstanceOf(PaymentForbiddenError);
    holder.user = actors.technicianA.client; await expect(repo.getAdminOverview()).rejects.toBeInstanceOf(PaymentForbiddenError);
    holder.user = actors.superX.client;
    await expect(repo.setPolicy({ expectedVersion: 999999, basisPoints: 100, reason: "Versión obsoleta de otra pestaña" })).rejects.toBeInstanceOf(PaymentConflictError);
    await expect(repo.setPolicy({ expectedVersion: 1, basisPoints: 2001, reason: "Porcentaje fuera de rango permitido" })).rejects.toBeInstanceOf(PaymentConflictError);
    await expect(repo.requestReconciliation(randomUUID())).rejects.toBeInstanceOf(PaymentConflictError); // no pending check for an unknown attempt
  });

  it("retention purge through real PostgREST: the worker role can run it (30 days purges nothing fresh); a signed-in user cannot", async () => {
    const { SupabasePaymentWorkerRepository } = await import("./supabase-payment-repository");
    expect(await new SupabasePaymentWorkerRepository().purgeSensitive(30)).toBe(0);
    const denied = await actors.customerA.client.rpc("payment_purge_sensitive", { retention_days: 30 });
    expect(denied.error).not.toBeNull(); expect(denied.data).toBeNull();
  });
});
