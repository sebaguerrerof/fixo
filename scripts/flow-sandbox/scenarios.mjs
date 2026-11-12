// Scenario runner for the REMOTE Flow Sandbox matrix (runbook §9). Each scenario uses its OWN synthetic job from the manifest, takes sanitized
// before/after snapshots (statuses and truncated identifiers only) and appends them to the manifest's evidence list.
// Usage: FIXO_FLOW_SANDBOX_REMOTE=<ref> node scenarios.mjs <scenario> [jobId]
import assert from 'node:assert/strict';
import { PROJECT_REF, SITE, actorClient, lit, loadEnv, readManifest, readSecrets, rpc, sql, stamp, writeManifest, writeSecrets } from './lib.mjs';
import { createJob } from './fixtures.mjs';
import { loginAs, openBrowser, startPayment } from './browser.mjs';

assert.equal(process.env.FIXO_FLOW_SANDBOX_REMOTE, PROJECT_REF);
const [scenario, givenJob] = process.argv.slice(2), env = await loadEnv(), shotDir = process.env.FIXO_FLOW_SHOTS;
const tail = v => (v === null || v === undefined ? null : String(v).slice(-4));
const wait = ms => new Promise(r => setTimeout(r, ms));

async function snapshot(job) {
  const [r] = await sql(`select
   (select payment_state from public.jobs where id=${lit(job)}) job_state,
   (select json_agg(json_build_object('status',o.status,'review',o.review_reason,'cost',o.flow_cost_clp,'total',o.total_clp,'origin',o.origin) order by o.created_at) from private.payment_orders o where o.job_id=${lit(job)}) orders,
   (select json_agg(json_build_object('state',a.state,'flow',right(a.flow_order::text,4),'err',a.error_code,'ref_len',length(a.commerce_order)) order by a.created_at) from private.payment_attempts a join private.payment_orders o on o.id=a.order_id where o.job_id=${lit(job)}) attempts,
   (select json_agg(json_build_object('validation',e.validation,'status',e.observed_status,'amount',e.amount_clp,'fee',e.flow_fee_clp) order by e.observed_at,e.id) from private.payment_events e join private.payment_orders o on o.id=e.order_id where o.job_id=${lit(job)}) events,
   (select json_agg(json_build_object('state',i.state,'gen',i.generation,'processed',i.processed_generation,'reason',i.quarantine_reason) order by i.first_received_at) from private.payment_inbox i) inbox_all,
   (select count(*)::int from private.job_events e where e.job_id=${lit(job)} and e.source='provider') provider_job_events`);
  return r;
}
async function record(name, job, data) {
  const m = await readManifest(); (m.evidence ??= []).push({ at: stamp(), scenario: name, job, ...data }); await writeManifest(m);
  console.log(JSON.stringify({ scenario: name, ...data }));
}
async function newJobFor(label) { const j = await createJob(env, label); return j.job; }
const ownJob = async (job) => { const m = await readManifest(); assert.ok(m.jobs.some(j => j.id === job), 'el trabajo no está en el manifiesto'); return job; };

/** Presses «Pagar», optionally chooses the simulator outcome. outcome: approve | reject | abandon. Captures the Flow token privately (never printed). */
async function payThroughFlow(job, outcome, { screenshots = false } = {}) {
  const browser = await openBrowser();
  try {
    const { page } = await loginAs(browser, 'customer');
    await startPayment(page, job, shotDir ?? '.'); const u = new URL(page.url());
    const out = { reachedFlow: u.hostname === 'sandbox.flow.cl' };
    if (u.searchParams.get('token')) { const s = await readSecrets(); (s.tokens ??= {})[job] = u.searchParams.get('token'); await writeSecrets(s); }
    if (outcome === 'abandon' || !out.reachedFlow) return out;
    await Promise.all([page.waitForLoadState('domcontentloaded').catch(() => {}), page.getByText('Pagar ahora', { exact: true }).first().click()]); await page.waitForTimeout(2500);
    const options = (await page.locator('select option').allInnerTexts()).map(t => t.trim());
    const pick = options.find(o => ({ approve: /pagar/i, reject: /rechaz/i })[outcome].test(o)); assert.ok(pick, 'sin opción ' + outcome);
    await page.locator('select').selectOption({ label: pick });
    await Promise.all([page.waitForLoadState('domcontentloaded').catch(() => {}), page.getByRole('button', { name: /Confirmar/i }).click()]); await page.waitForTimeout(4000);
    const back = new URL(page.url()); Object.assign(out, { simulatorOptions: options, chose: outcome, returnedTo: back.hostname + back.pathname, tokenInReturnUrl: back.searchParams.has('token') });
    if (screenshots && shotDir) await page.screenshot({ path: `${shotDir}/after-${outcome}.png`, fullPage: true }).catch(() => {});
    return out;
  } finally { await browser.close(); }
}
const until = async (fn, ms, label) => { const end = Date.now() + ms; while (Date.now() < end) { const v = await fn(); if (v) return v; await wait(5000); } throw new Error('timeout: ' + label); };
const sum = s => ({ job_state: s.job_state, orders: s.orders, attempts: s.attempts, events: s.events, inbox: s.inbox_all, provider_job_events: s.provider_job_events });
const postToken = (path, token) => fetch(SITE + path, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token }).toString(), redirect: 'manual' });

const scenarios = {
  /** S2: Flow rejects (status 3) -> attempt failed, order still payable; a NEW attempt then succeeds: one order, one paid attempt. */
  async rejected() {
    const job = givenJob ? await ownJob(givenJob) : await newJobFor('rechazado');
    const flow1 = await payThroughFlow(job, 'reject');
    const failed = await until(async () => { const s = await snapshot(job); return s.attempts?.some(a => a.state === 'failed' && a.flow) ? s : null; }, 240000, 'attempt failed after rejection');
    await record('rejected/after-rejection', job, { flow: flow1, ...sum(failed) });
    assert.equal(failed.orders[0].status, 'awaiting_payment'); assert.equal(failed.job_state, 'payment_pending');
    const flow2 = await payThroughFlow(job, 'approve');
    const paid = await until(async () => { const s = await snapshot(job); return s.orders?.[0]?.status === 'paid' ? s : null; }, 240000, 'order paid after the retry');
    await record('rejected/retry-approved', job, { flow: flow2, ...sum(paid) });
    assert.equal(paid.orders.length, 1); assert.equal(paid.attempts.filter(a => a.state === 'paid').length, 1);
  },
  /** S3: checkout left open = pending; reopening it reuses the same attempt/Flow order (no second charge). */
  async pending() {
    const job = givenJob ? await ownJob(givenJob) : await newJobFor('pendiente');
    const a = await payThroughFlow(job, 'abandon'); const s1 = await snapshot(job); await record('pending/first-open', job, { flow: a, ...sum(s1) });
    const b = await payThroughFlow(job, 'abandon'); const s2 = await snapshot(job); await record('pending/reopen', job, { flow: b, ...sum(s2) });
    assert.equal(s2.attempts.length, s1.attempts.length, 'reabrir no debe crear otro intento'); assert.equal(s2.attempts.at(-1).flow, s1.attempts.at(-1).flow);
    assert.equal(s2.attempts.at(-1).state, 'pending'); assert.equal(s2.orders.length, 1);
    console.log('verifying that the worker keeps it pending (reconciliation by Flow order) for ~2 minutes');
    await wait(130000); const s3 = await snapshot(job); await record('pending/after-reconciliation', job, sum(s3)); assert.equal(s3.attempts.at(-1).state, 'pending'); assert.equal(s3.orders[0].status, 'awaiting_payment');
  },
  /** S5: duplicate/replayed callbacks, a fabricated token, an invalid body, and a state change for the SAME token (pending -> paid): never a second charge, event or notice. */
  async duplicates() {
    const job = await ownJob(givenJob); const secrets = await readSecrets(), token = secrets.tokens?.[job]; assert.ok(token, 'sin token capturado para el trabajo (ejecute pending antes)');
    const fake = 'FAKE' + Math.random().toString(16).slice(2, 12).toUpperCase() + 'ZZ';
    const before = await snapshot(job); const evBefore = (before.events ?? []).length;
    const r = []; for (let i = 0; i < 3; i++) r.push((await postToken('/api/payments/flow/confirmation', token)).status);
    for (let i = 0; i < 2; i++) r.push((await postToken('/api/payments/flow/confirmation', fake)).status);
    r.push((await fetch(SITE + '/api/payments/flow/confirmation', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'nope=1' })).status);
    r.push((await fetch(SITE + '/api/payments/flow/confirmation', { method: 'GET' })).status);
    console.log('callback statuses (3 real, 2 fake, 1 invalid body, 1 GET): ' + JSON.stringify(r));
    await wait(150000); const mid = await snapshot(job);
    await record('duplicates/replayed-while-pending', job, { callbackStatuses: r, ...sum(mid) });
    assert.equal((mid.events ?? []).length, evBefore, 'los duplicados no deben crear eventos'); assert.equal(mid.attempts.length, before.attempts.length); assert.equal(mid.orders[0].status, 'awaiting_payment');
    const pay = await payThroughFlow(job, 'approve');
    const paid = await until(async () => { const x = await snapshot(job); return x.orders?.[0]?.status === 'paid' ? x : null; }, 240000, 'paid for the same token');
    const r2 = []; for (let i = 0; i < 3; i++) r2.push((await postToken('/api/payments/flow/confirmation', token)).status);
    await wait(150000); const end = await snapshot(job);
    await record('duplicates/state-change-and-replay-after-paid', job, { flow: pay, callbackStatuses: r2, ...sum(end) });
    assert.equal(end.orders.length, 1); assert.equal(end.attempts.filter(a => a.state === 'paid').length, 1);
    assert.equal(end.events.filter(e => e.status === 2).length, 1, 'un solo evento de pago'); assert.equal(end.provider_job_events, paid.provider_job_events, 'sin avisos adicionales tras los duplicados');
  },
};
if (!scenarios[scenario]) { console.error('escenarios: ' + Object.keys(scenarios).join(', ')); process.exit(2); }
await scenarios[scenario]();
