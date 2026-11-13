// Local-only proof of the Supabase Cron executor (supabase/ops/payments-worker-cron.sql) against the ISOLATED local Supabase stack.
// A tiny local HTTP server plays the Vercel endpoint: nothing external is contacted, no remote database is touched, Flow is never involved.
//   Requires: FIXO_PAYMENTS_LOCAL_SUPABASE=isolated-local and FIXO_TEST_DB_URL (loopback). Docker Desktop must be running (pg_cron / pg_net live in the container).
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const dbUrl = process.env.FIXO_TEST_DB_URL;
assert.equal(process.env.FIXO_PAYMENTS_LOCAL_SUPABASE, 'isolated-local', 'refusing to run without FIXO_PAYMENTS_LOCAL_SUPABASE=isolated-local');
assert.ok(dbUrl && ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(dbUrl).hostname), 'FIXO_TEST_DB_URL must be loopback');
const SECRET = randomBytes(32).toString('hex'), PORT = 38000 + Math.floor(Math.random() * 1000);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const HEALTHY = { inbox: 0, attempts: 0, quarantined: 0, retried: 0, failures: 0, cleaned: 0, purged: 0, housekeepingFailures: 0 };
const requests = []; let mode = 200, body200 = HEALTHY;
const server = createServer((req, res) => {
  let body = ''; req.on('data', c => { body += c; });
  req.on('end', () => {
    requests.push({ method: req.method, url: req.url, auth: req.headers.authorization, type: req.headers['content-type'], body });
    res.writeHead(mode, { 'content-type': 'application/json' });
    res.end(mode === 200 ? JSON.stringify(body200) : JSON.stringify({ error: 'unavailable' }));
  });
});
await new Promise(r => server.listen(PORT, '0.0.0.0', r));
const db = new pg.Client({ connectionString: dbUrl }); await db.connect();
const q = async (sql, args) => (await db.query(sql, args)).rows;
const waitFor = async (fn, ms = 20000, label = 'condition') => { const end = Date.now() + ms; while (Date.now() < end) { const v = await fn(); if (v) return v; await sleep(500); } throw new Error('timed out waiting for ' + label); };
const checks = []; const check = async (name, fn) => { await fn(); checks.push(name); console.log('PASS  ' + name); };
const setSecrets = async (url, secret) => {
  await q("delete from vault.secrets where name in('fixo_payments_worker_url','fixo_payments_worker_secret')");
  if (url) await q("select vault.create_secret($1,'fixo_payments_worker_url','local test')", [url]);
  if (secret) await q("select vault.create_secret($1,'fixo_payments_worker_secret','local test')", [secret]);
};
const tick = async () => (await q('select private.payment_worker_tick() v'))[0].v;
const health = async () => (await q('select private.payment_worker_health() v'))[0].v;
const goodUrl = `http://host.docker.internal:${PORT}/api/payments/worker`;

try {
  await q("select cron.unschedule(jobid) from cron.job where jobname='fixo-payments-worker'").catch(() => {});   // first run: extension may not exist yet
  await db.query(await readFile(new URL('../supabase/ops/payments-worker-cron.sql', import.meta.url), 'utf8'));
  await q("select cron.unschedule(jobid) from cron.job where jobname='fixo-payments-worker'");                      // manual ticks first; the real schedule is proven last
  await q('delete from private.payment_worker_ticks');

  await check('without configuration (or with a malformed/foreign endpoint) a tick sends NOTHING and never echoes the secret', async () => {
    await setSecrets(null, null); assert.equal(await tick(), null);
    await setSecrets(goodUrl, null); assert.equal(await tick(), null);
    await setSecrets(goodUrl, 'short'); assert.equal(await tick(), null);
    for (const bad of ['http://evil.example/api/payments/worker', `https://soyfixo.cl/other`, `http://host.docker.internal:${PORT}/api/payments/worker?x=1`, 'ftp://x/api/payments/worker']) { await setSecrets(bad, SECRET); assert.equal(await tick(), null, bad); }
    await sleep(2500); assert.equal(requests.length, 0); assert.equal((await q('select count(*)::int n from private.payment_worker_ticks'))[0].n, 0);
  });

  await check('a configured tick POSTs once with the exact bearer secret to the exact path; health reports success with counters only', async () => {
    await setSecrets(goodUrl, SECRET); const id = await tick(); assert.ok(id);
    await waitFor(() => requests.length >= 1, 20000, 'the request to reach the endpoint');
    const r = requests[0]; assert.deepEqual({ m: r.method, u: r.url, a: r.auth, t: r.type, b: r.body }, { m: 'POST', u: '/api/payments/worker', a: 'Bearer ' + SECRET, t: 'application/json', b: '{}' });
    const h = await waitFor(async () => { const v = await health(); return v.last_status === 200 ? v : null; }, 20000, 'the response to be recorded');
    assert.equal(h.degraded, false); assert.ok(h.ok_15m >= 1); assert.equal(h.last_summary.housekeepingFailures, 0); assert.equal(h.stale, false); assert.deepEqual(Object.keys(h.last_summary).sort(), ['attempts', 'cleaned', 'failures', 'housekeepingFailures', 'inbox', 'purged', 'quarantined', 'retried']);
  });

  await check('endpoint errors are visible (degraded) and recover on their own; a repeated tick is just another harmless idempotent request', async () => {
    mode = 500; for (let i = 0; i < 2; i++) await tick();
    const bad = await waitFor(async () => { const v = await health(); return v.degraded === true && v.failed_15m >= 2 ? v : null; }, 25000, 'failures to be reported');
    assert.equal(bad.last_status, 500); assert.equal(bad.last_summary, null);
    mode = 200; for (let i = 0; i < 5; i++) { await tick(); await sleep(300); }
    const ok = await waitFor(async () => { const v = await health(); return v.degraded === false && v.last_status === 200 ? v : null; }, 30000, 'recovery');
    assert.equal(ok.last_status, 200);
    // An unreachable endpoint is also reported (timed out / no answer), never silently ignored.
    await setSecrets(`http://host.docker.internal:${PORT + 1}/api/payments/worker`, SECRET); await tick();
    const down = await waitFor(async () => { const v = await health(); return v.degraded === true ? v : null; }, 30000, 'an unreachable endpoint to be reported');
    assert.ok(down.last_status === null);
    await setSecrets(goodUrl, SECRET);
  });

  await check('HTTP 200 is NOT enough: internal worker failures or failed housekeeping make the executor degraded; recovery needs healthy runs', async () => {
    await q('delete from private.payment_worker_ticks'); await tick();
    await waitFor(async () => (await health()).ok_15m >= 1, 20000, 'a healthy run'); assert.equal((await health()).degraded, false);
    for (const bad of [{ ...HEALTHY, failures: 2 }, { ...HEALTHY, housekeepingFailures: 1 }, { inbox: 1 }]) {   // last one: counters missing/garbled => fail closed
      body200 = bad; await q('delete from private.payment_worker_ticks'); await tick();
      const h = await waitFor(async () => { const v = await health(); return v.last_status === 200 ? v : null; }, 20000, 'the response to be recorded');
      assert.equal(h.degraded, true, JSON.stringify(bad)); assert.equal(h.ok_15m, 0); assert.ok(h.internal_failures_15m >= 1); assert.equal(h.failed_15m, 0);   // status alone says 200
    }
    body200 = HEALTHY; await q('delete from private.payment_worker_ticks'); for (let i = 0; i < 5; i++) { await tick(); await sleep(300); }
    const ok = await waitFor(async () => { const v = await health(); return v.degraded === false && v.ok_15m >= 5 ? v : null; }, 30000, 'recovery with healthy runs');
    assert.equal(ok.internal_failures_15m, 0);
  });

  await check('a stopped executor is degraded: no ticks at all, or only old ticks, never reports healthy', async () => {
    await q('delete from private.payment_worker_ticks');
    let h = await health(); assert.equal(h.degraded, true); assert.equal(h.stale, true); assert.equal(h.last_request_at, null); assert.equal(h.ok_15m, 0);
    await tick(); await waitFor(async () => (await health()).degraded === false, 20000, 'a fresh healthy tick');
    await q("update private.payment_worker_ticks set requested_at=now()-interval '10 minutes'");               // the cron stopped 10 minutes ago
    h = await health(); assert.equal(h.degraded, true); assert.equal(h.stale, true); assert.ok(h.last_request_age_seconds >= 600);
    await q("update private.payment_worker_ticks set requested_at=now()-interval '4 minutes'");
    h = await health(); assert.equal(h.stale, true); assert.equal(h.degraded, true);
    await q("update private.payment_worker_ticks set requested_at=now()-interval '90 seconds'");
    h = await health(); assert.equal(h.stale, false); assert.equal(h.degraded, false);                           // within the tolerated window
    await q('delete from private.payment_worker_ticks'); await tick(); await waitFor(async () => (await health()).degraded === false, 20000, 'recovery');
  });

  await check('the secret exists only in Vault: not in the cron command, the tick log, or any API-role privilege', async () => {
    const cmd = (await q("select command from cron.job where jobname='fixo-payments-worker'"))[0]?.command ?? ''; assert.ok(!cmd.includes(SECRET));
    assert.equal((await q('select count(*)::int n from private.payment_worker_ticks where request_id::text like $1', ['%' + SECRET.slice(0, 8) + '%']))[0].n, 0);
    const fn = (await q("select pg_get_functiondef('private.payment_worker_tick()'::regprocedure) d"))[0].d; assert.ok(!fn.includes(SECRET));
    for (const role of ['anon', 'authenticated', 'service_role']) {
      for (const f of ['private.payment_worker_tick()', 'private.payment_worker_health()', 'private.payment_worker_response_healthy(integer,text,text)']) assert.equal((await q('select has_function_privilege($1,$2,$3) v', [role, f, 'EXECUTE']))[0].v, false, role + ' ' + f);
      assert.equal((await q('select has_table_privilege($1,$2,$3) v', [role, 'private.payment_worker_ticks', 'SELECT']))[0].v, false);
    }
    assert.equal((await q("select relrowsecurity v from pg_class where oid='private.payment_worker_ticks'::regclass"))[0].v, true);
  });

  await check('REAL pg_cron: the job is scheduled every minute and fires without a manual tick; unscheduling stops it', async () => {
    await q('delete from private.payment_worker_ticks'); requests.length = 0;
    await db.query(await readFile(new URL('../supabase/ops/payments-worker-cron.sql', import.meta.url), 'utf8'));   // re-run = idempotent (replaces the job of the same name)
    const jobs = await q("select schedule,active from cron.job where jobname='fixo-payments-worker'"); assert.deepEqual(jobs, [{ schedule: '* * * * *', active: true }]);
    assert.equal((await health()).scheduled, true);
    await waitFor(() => requests.length >= 1, 100000, 'pg_cron to call the endpoint (<= 1 minute)');
    assert.equal(requests[0].auth, 'Bearer ' + SECRET); assert.ok((await q('select count(*)::int n from private.payment_worker_ticks'))[0].n >= 1);
    const run = await waitFor(async () => (await q("select status from cron.job_run_details d join cron.job j on j.jobid=d.jobid where j.jobname='fixo-payments-worker' order by d.start_time desc limit 1"))[0], 20000, 'a job run record');
    assert.equal(run.status, 'succeeded');
    await db.query(await readFile(new URL('../supabase/ops/payments-worker-cron-rollback.sql', import.meta.url), 'utf8'));
    assert.equal((await q("select count(*)::int n from cron.job where jobname='fixo-payments-worker'"))[0].n, 0); assert.equal((await health()).scheduled, false);
  });
  console.log(JSON.stringify({ status: 'PASS local', checks: checks.length, remote: false }));
} finally {
  await q("select cron.unschedule(jobid) from cron.job where jobname='fixo-payments-worker'").catch(() => {});
  await q("delete from vault.secrets where name in('fixo_payments_worker_url','fixo_payments_worker_secret')").catch(() => {});
  await q('delete from private.payment_worker_ticks').catch(() => {});
  await db.end().catch(() => {}); server.close();
}
