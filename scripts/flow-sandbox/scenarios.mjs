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
/** Completes the Flow checkout that is ALREADY open (the customer still has the Flow page): no Fixo login or button is involved. */
async function payOnFlowDirect(job, outcome) {
  const token = (await readSecrets()).tokens?.[job]; assert.ok(token, 'sin token capturado para el trabajo');
  const browser = await openBrowser();
  try {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-CL' })).newPage();
    await page.goto(`https://sandbox.flow.cl/app/web/pay.php?token=${encodeURIComponent(token)}`, { waitUntil: 'domcontentloaded' });
    await Promise.all([page.waitForLoadState('domcontentloaded').catch(() => {}), page.getByText('Pagar ahora', { exact: true }).first().click()]); await page.waitForTimeout(2500);
    const options = (await page.locator('select option').allInnerTexts()).map(t => t.trim());
    const pick = options.find(o => ({ approve: /pagar/i, reject: /rechaz/i })[outcome].test(o)); assert.ok(pick, 'sin opción ' + outcome);
    await page.locator('select').selectOption({ label: pick });
    await Promise.all([page.waitForLoadState('domcontentloaded').catch(() => {}), page.getByRole('button', { name: /Confirmar/i }).click()]); await page.waitForTimeout(4000);
    const back = new URL(page.url()); return { reachedFlow: true, chose: outcome, returnedTo: back.hostname + back.pathname, tokenInReturnUrl: back.searchParams.has('token') };
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
  /** S6: cancellation approved while the checkout is open, then Flow approves: late payment => stays paid, in review, the job is NOT reactivated. */
  async late() {
    const job = givenJob ? await ownJob(givenJob) : await newJobFor('pago tardio');
    const open = await payThroughFlow(job, 'abandon'); const s0 = await snapshot(job); await record('late/checkout-open', job, { flow: open, ...sum(s0) });
    const secrets = await readSecrets(), customer = await actorClient(env, secrets, 'customer'), sup = await actorClient(env, secrets, 'superadmin');
    const rev = async () => (await rpc(customer, 'job_detail', { job_id: job })).job.revision;
    const req = await rpc(customer, 'job_command', { job_id: job, operation_id: crypto.randomUUID(), expected_revision: await rev(), action: 'request_cancellation', payload: { reason: 'Cancelación sintética de la prueba de pago tardío' } });
    await rpc(sup, 'job_command', { job_id: job, operation_id: crypto.randomUUID(), expected_revision: (await rpc(sup, 'job_detail', { job_id: job })).job.revision, action: 'resolve_cancellation', payload: { cancellationId: req.resource_id, decision: 'approved', reason: 'Cancelación sintética aprobada en la prueba' } });
    const s1 = await snapshot(job); await record('late/after-cancellation', job, sum(s1)); assert.equal(s1.orders[0].review, 'job_cancelled'); assert.equal(s1.orders[0].status, 'awaiting_payment');
    await scenarios.latefinish(job, customer);
  },
  async lateresume() { const job = await ownJob(givenJob); const customer = await actorClient(env, await readSecrets(), 'customer'); await scenarios.latefinish(job, customer); },
  async latefinish(job, customer) {
    const pay = await payOnFlowDirect(job, 'approve');
    const done = await until(async () => { const x = await snapshot(job); return x.orders?.[0]?.status === 'paid' ? x : null; }, 240000, 'late payment recorded');
    const detail = await rpc(customer, 'job_detail', { job_id: job }); await record('late/payment-after-cancellation', job, { flow: pay, jobStatus: detail.job.status, ...sum(done) });
    assert.equal(detail.job.status, 'cancelled'); assert.equal(done.orders[0].review, 'job_cancelled'); assert.equal(done.attempts.filter(a => a.state === 'paid').length, 1);
    assert.ok(done.events.some(e => e.status === 2 && e.validation === 'late_payment'), 'pago tardío registrado');
  },
  /** S7: the Flow notification is LOST. The worker is paused (cron unscheduled) so it cannot claim the row; the received notification is deleted by exact token hash;
   *  after the schedule is restored the worker must credit the payment by reconciling the attempt on its own (no notification exists). */
  async nocallback() {
    const { createHash } = await import('node:crypto');
    const job = givenJob ? await ownJob(givenJob) : await newJobFor('sin callback');
    await sql(`select cron.unschedule(jobid) from cron.job where jobname='fixo-payments-worker'`);
    let pay, deleted, pre, lost;
    try {
      pay = await payThroughFlow(job, 'approve'); const token = (await readSecrets()).tokens[job], hash = createHash('sha256').update(token, 'utf8').digest('hex');
      [pre] = await sql(`select state from private.payment_inbox where token_sha256=${lit(hash)}`);
      deleted = (await sql(`delete from private.payment_inbox where token_sha256=${lit(hash)} and state='pending' returning 1 as n`)).length;
      lost = await snapshot(job); await record('nocallback/notification-lost-worker-paused', job, { flow: pay, inboxBeforeDelete: pre?.state ?? null, deleted, ...sum(lost) });
      assert.equal(deleted, 1, 'la notificación debía estar pendiente (el worker está detenido)'); assert.equal(lost.orders[0].status, 'awaiting_payment', 'sin worker ni notificación el pago aún no consta');
      this.hash = hash;
    } finally { await sql(`select cron.schedule('fixo-payments-worker','* * * * *','select private.payment_worker_tick()')`); }
    const done = await until(async () => { const x = await snapshot(job); return x.orders?.[0]?.status === 'paid' ? x : null; }, 420000, 'reconciliation without any notification');
    await record('nocallback/reconciled-by-worker', job, sum(done)); assert.equal(done.attempts.filter(a => a.state === 'paid').length, 1); assert.equal(done.events.filter(e => e.status === 2).length, 1);
    assert.equal((await sql(`select 1 from private.payment_inbox where token_sha256=${lit(this.hash)}`)).length, 0, 'no existe ninguna notificación: la conciliación fue independiente');
  },
  /** S8: the worker is DOWN (cron unscheduled) while the customer pays; after it is rescheduled the backlog is processed once. */
  async workerdown() {
    const job = givenJob ? await ownJob(givenJob) : await newJobFor('worker caido');
    await sql(`select cron.unschedule(jobid) from cron.job where jobname='fixo-payments-worker'`);
    try {
      const pay = await payThroughFlow(job, 'approve'); console.log('worker stopped; waiting 150 s'); await wait(150000);
      const down = await snapshot(job); await record('workerdown/while-stopped', job, { flow: pay, ...sum(down) });
      assert.equal(down.orders[0].status, 'awaiting_payment', 'sin worker nada debe acreditar el pago'); assert.ok(down.inbox_all.some(i => i.state === 'pending'), 'la notificación quedó en la bandeja');
    } finally { await sql(`select cron.schedule('fixo-payments-worker','* * * * *','select private.payment_worker_tick()')`); }
    const done = await until(async () => { const x = await snapshot(job); return x.orders?.[0]?.status === 'paid' ? x : null; }, 240000, 'backlog processed after restart');
    await record('workerdown/after-restart', job, sum(done)); assert.equal(done.attempts.filter(a => a.state === 'paid').length, 1); assert.equal(done.events.filter(e => e.status === 2).length, 1);
  },
  /** S9: initial payment done -> job scheduled -> technician proposes an extra -> customer accepts (consent) -> pending balance visible -> extra paid through Flow. */
  async extra() {
    const job = await ownJob(givenJob); const secrets = await readSecrets();
    const customer = await actorClient(env, secrets, 'customer'), tech = await actorClient(env, secrets, 'technician');
    const detail = async a => rpc(a, 'job_detail', { job_id: job });
    const cmd = async (a, action, payload = {}) => rpc(a, 'job_command', { job_id: job, operation_id: crypto.randomUUID(), expected_revision: (await detail(a)).job.revision, action, payload });
    const start = new Date(Date.now() + 172800000); start.setUTCHours(15, 0, 0, 0); const end = new Date(start.getTime() + 2 * 3600000);
    const part = d => Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map(x => [x.type, x.value]));
    const a = part(start), b = part(end);
    if ((await detail(customer)).job.status !== 'scheduled') {
      await cmd(tech, 'propose_schedule', { startsAt: start.toISOString(), endsAt: end.toISOString(), localDate: `${a.year}-${a.month}-${a.day}`, startTime: `${a.hour}:${a.minute}`, endTime: `${b.hour}:${b.minute}`, reason: 'Propuesta sintética de la prueba Flow Sandbox' });
      const d = await detail(customer); await cmd(customer, 'accept_schedule', { proposalId: d.schedules.find(x => x.state === 'proposed').id });
    }
    const x = await rpc(tech, 'job_extra_propose', { target_job: job, operation_id: crypto.randomUUID(), concept_text: 'Adicional sintético de la prueba Flow Sandbox', amount: 10000 });
    const policy = await rpc(customer, 'payment_policy_current', {}); const pre = await rpc(customer, 'job_payments', { target_job: job });
    await record('extra/proposed', job, { unpaidExtras: pre.unpaid_extras, extrasStates: pre.extras.map(e => e.state) });
    await rpc(customer, 'job_extra_respond', { target_extra: x.id, decision: 'accepted', expected_policy_version: policy.version, reason_text: null });
    const accepted = await rpc(customer, 'job_payments', { target_job: job }); await record('extra/accepted-balance-visible', job, { unpaidExtras: accepted.unpaid_extras, orders: accepted.orders.map(o => ({ origin: o.origin, status: o.status })) });
    assert.equal(accepted.unpaid_extras, true, 'el saldo del adicional aceptado debe verse antes del cierre');
    const pay = await payThroughFlow(job, 'approve');
    const done = await until(async () => { const z = await snapshot(job); return z.orders?.filter(o => o.status === 'paid').length === 2 ? z : null; }, 300000, 'extra paid');
    const after = await rpc(customer, 'job_payments', { target_job: job });
    await record('extra/paid', job, { flow: pay, unpaidExtras: after.unpaid_extras, ...sum(done) });
    assert.equal(after.unpaid_extras, false); assert.equal(done.attempts.filter(a2 => a2.state === 'paid').length, 2); assert.equal(done.orders.filter(o => o.origin === 'extra').length, 1);
  },
};
if (!scenarios[scenario]) { console.error('escenarios: ' + Object.keys(scenarios).join(', ')); process.exit(2); }
await scenarios[scenario]();
