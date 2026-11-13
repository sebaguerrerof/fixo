// Sprint 05 — real-browser checks of the payment screens per role (PLAN section 10, "Navegador").
// LOCAL ONLY: isolated local Supabase stack + a local Next dev server + headless Chrome. It never reads .env.local values into the
// test, never contacts Flow (payments stay disabled), refuses non-loopback targets, and fails if the browser requests any other origin.
// NOTE: it creates `s05-br-*@local.invalid` users and CHANGES THE FEE POLICY (versions only grow): run `supabase db reset` afterwards.
//   FIXO_PAYMENTS_LOCAL_SUPABASE=isolated-local FIXO_TEST_SUPABASE_URL FIXO_TEST_ANON_KEY FIXO_TEST_SERVICE_ROLE_KEY FIXO_TEST_DB_URL
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { chromium, expect as baseExpect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const e = process.env, loopback = v => { try { return ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(v).hostname); } catch { return false; } };
const url = e.FIXO_TEST_SUPABASE_URL ?? '', anon = e.FIXO_TEST_ANON_KEY ?? '', service = e.FIXO_TEST_SERVICE_ROLE_KEY ?? '', dbUrl = e.FIXO_TEST_DB_URL ?? '';
assert.equal(e.FIXO_PAYMENTS_LOCAL_SUPABASE, 'isolated-local', 'FIXO_PAYMENTS_LOCAL_SUPABASE=isolated-local requerido');
assert.ok(loopback(url) && loopback(dbUrl) && anon && service, 'Sólo destinos loopback con claves locales');
const PORT = 3055, origin = `http://127.0.0.1:${PORT}`, expect = baseExpect.configure({ timeout: 60000 });
const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const checks = [], pageErrors = [], requested = new Set(), fixoUrls = [];
let server, browser, page, db;

const admin = createClient(url, service, opts);
const actors = {};
async function makeActor(label, type) {
  const email = `s05-br-${label}-${randomUUID().slice(0, 8)}@local.invalid`, password = `Local-Only-${randomBytes(12).toString('hex')}9A`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { first_name: 'Synthetic', last_name: label, phone: '+56912345678', terms_accepted: true, account_type: type, category_ids: ['gasfiteria'], coverage_areas: ['Ñuñoa'] } });
  assert.equal(created.error, null);
  const client = createClient(url, anon, opts); assert.equal((await client.auth.signInWithPassword({ email, password })).error, null);
  actors[label] = { id: created.data.user.id, email, password, client };
}
async function rpc(label, name, args) { const r = await actors[label].client.rpc(name, args); assert.equal(r.error, null, `${name}: ${r.error?.message}`); return r.data; }
const money = n => new RegExp('\\$\\s?' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\\.'));

async function newJob() {
  await db.query("update public.service_requests set created_at=now()-interval '3 days' where customer_id=$1", [actors.customer.id]);
  const r = await rpc('customer', 'marketplace_create_request', { operation_id: randomUUID(), payload: { title: 'Fuga bajo lavaplatos', categoryId: 'gasfiteria', description: 'Necesito reparar una fuga de agua bajo el lavaplatos.', locationLabel: 'Nunoa', address: 'Synthetic private address', reference: 'Synthetic reference', preferredSlot: 'Mañana', scheduledFor: null } });
  const payload = { laborClp: 20000, materialsClp: 5000, diagnosticClp: 0, description: 'Reparación y revisión completa de la fuga indicada.', materialsIncluded: 'Sello', materialsNotIncluded: '', diagnosticVisit: false, estimatedDuration: '2 horas', availableDate: new Date(Date.now() + 86400000).toISOString(), conditions: 'Solo trabajo descrito', expiresAt: new Date(Date.now() + 172800000).toISOString() };
  let q = await rpc('technician', 'marketplace_save_quote', { request_id: r.id, operation_id: randomUUID(), payload });
  q = await rpc('technician', 'marketplace_transition_quote', { quote_id: q.id, next_status: 'submitted', expected_revision: q.revision });
  return (await rpc('customer', 'marketplace_accept_quote', { request_id: r.id, quote_id: q.id, expected_revision: q.revision })).job.id;
}
let flow = 880000 + Math.floor(Math.random() * 1000);
/** Verified payment through the same RPCs the worker uses (no Flow): prepare -> reserve -> checkout -> verified observation WITHOUT Flow cost. */
async function payInitial(jobId) {
  const policy = await rpc('customer', 'payment_policy_current', {});
  const p = await rpc('customer', 'payment_prepare', { target_job: jobId, target_extra: null, expected_policy_version: policy.version, consent: true, idempotency_key: randomUUID() });
  const svc = async (name, args) => { const r = await admin.rpc(name, args); assert.equal(r.error, null, `${name}: ${r.error?.message}`); return r.data; };
  await svc('payment_attempt_begin_create', { target_attempt: p.attempt_id }); const fo = ++flow;
  await svc('payment_attempt_set_checkout', { target_attempt: p.attempt_id, flow_order_id: fo, ciphertext: '\\x0102', key_id: 'test-key' });
  const o = await svc('payment_apply_observation', { target_attempt: p.attempt_id, event_key: 'br-' + p.attempt_id, observed_flow_order: fo, observed_commerce_order: p.commerce_order, observed_status: 2, observed_amount: p.total_clp, observed_currency: 'CLP', observed_fee: null, provider_time: null });
  assert.equal(o.result, 'applied');
}

async function show(context, path) {
  await Promise.race([page?.close().catch(() => {}), new Promise(r => setTimeout(r, 5000))]); page = await context.newPage();
  page.on('pageerror', x => pageErrors.push(String(x)));
  page.on('request', r => { const u = new URL(r.url()); if (u.protocol.startsWith('http')) { requested.add(u.origin); if (u.origin === origin) fixoUrls.push(u.pathname + u.search); } });
  const res = await page.goto(origin + path, { waitUntil: 'domcontentloaded', timeout: 120000 });
  // loading.tsx streams a placeholder first; never read content before the real page has replaced it.
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {}); // streamed content has arrived once the network is idle
  await page.waitForFunction(() => !document.body.innerText.includes('Cargando información'), null, { timeout: 90000 }).catch(() => {});
  return res;
}
async function login(context, label) {
  const a = actors[label];
  // next dev hydrates late: a click before hydration submits the form natively and reloads /login with empty fields. Wait for idle and retry.
  for (let attempt = 1; attempt <= 4; attempt++) {
    console.log('  login ' + label + ' attempt ' + attempt); await show(context, '/login'); await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await page.getByPlaceholder('tu@correo.cl', { exact: true }).fill(a.email); await page.getByPlaceholder('Tu contraseña', { exact: true }).fill(a.password);
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    try { await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: attempt === 1 ? 90000 : 30000 }); return; } catch { /* retry */ }
  }
  throw new Error('login failed for ' + label);
}
const noOverflow = async () => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'horizontal overflow');
const text = () => page.locator('body').innerText();
// Watchdog: a stuck navigation/dialog must fail loudly with context instead of hanging the run.
async function check(name, fn, limitMs = 240000) {
  console.log('CHECK ' + name); let timer;
  await Promise.race([fn(), new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('watchdog: check exceeded ' + limitMs / 1000 + 's at ' + (page?.url() ?? '(no page)'))), limitMs); })]).finally(() => clearTimeout(timer));
  checks.push(name); console.log('PASS  ' + name);
}

try {
  db = new pg.Client({ connectionString: dbUrl }); await db.connect();
  assert.equal((await db.query("select count(*)::int n from auth.users where email not like 's05-%@local.invalid'")).rows[0].n, 0, 'instancia con usuarios ajenos');
  for (const [l, t] of [['customer', 'customer'], ['stranger', 'customer'], ['technician', 'technician'], ['moderator', 'customer'], ['superadmin', 'customer']]) await makeActor(l, t);
  await db.query("update public.profiles set role='moderator' where id=$1", [actors.moderator.id]);
  await db.query("update public.profiles set role='superadmin' where id=$1", [actors.superadmin.id]);
  await db.query(`insert into private.category_requirements(category_id,requirement_key,version,kind,required,document_type,description,created_by) values('gasfiteria',$2,1,'internal',false,'other','Synthetic test criterion',$1)`, [actors.superadmin.id, `s05-${randomUUID().slice(0, 8)}`]);
  await db.query("update private.technician_applications set state='approved',primary_category='gasfiteria',requirement_snapshot=array(select id from private.category_requirements where active and category_id='gasfiteria' order by id),consent_at=now() where technician_id=$1", [actors.technician.id]);
  await db.query('update private.technician_applications set approved_fingerprint=private.professional_fingerprint(technician_id) where technician_id=$1', [actors.technician.id]);
  await db.query("update public.technician_profiles set status='active' where user_id=$1", [actors.technician.id]);

  // Sandbox payments are limited to authorized SYNTHETIC accounts (database-enforced, mirrored in the UI): authorize only the customer used for payments.
  await db.query("insert into private.payment_sandbox_accounts(user_id,authorized_by,reason) values($1,$2,'Cuenta sintética de la prueba de navegador local')", [actors.customer.id, actors.superadmin.id]);
  const jobA = await newJob(), jobB = await newJob();               // A: awarded, nothing paid. B: initial payment verified, scheduled.
  await payInitial(jobB); await db.query("update public.jobs set status='scheduled',revision=revision+1 where id=$1", [jobB]);

  // Local Next dev server. Process env overrides .env.local, so the app can only talk to the local stack; payments stay disabled.
  const nextBin = new URL('../node_modules/next/dist/bin/next', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  server = spawn(process.execPath, [nextBin, 'dev', '-H', '127.0.0.1', '-p', String(PORT)], { stdio: 'ignore', env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: anon, SUPABASE_SERVICE_ROLE_KEY: service, VERCEL_OIDC_TOKEN: '', VERCEL_ENV: '', NEXT_PUBLIC_DEMO_MODE: 'false', FIXO_APP_URL: origin, FIXO_FLOW_MODE: 'disabled', FIXO_PAYMENTS_CREATION_ENABLED: 'false', FIXO_PAYMENTS_NOTIFICATIONS_ENABLED: 'false', NEXT_TELEMETRY_DISABLED: '1' } });
  for (let i = 0; i < 90; i++) { try { if ((await fetch(origin + '/login')).status < 500) break; } catch { /* starting */ } await new Promise(r => setTimeout(r, 2000)); }

  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = async (w = 1440, h = 1000) => browser.newContext({ reducedMotion: 'reduce', viewport: { width: w, height: h } });
  const [customer, stranger, tech, moderator, superadmin, anonymous] = await Promise.all([ctx(), ctx(), ctx(), ctx(), ctx(), ctx()]);

  await check('unauthenticated users are sent to login from every payment screen', async () => {
    for (const p of [`/cliente/trabajos/${jobA}`, '/tecnico/pagos', '/admin/configuracion']) { await show(anonymous, p); await expect(page).toHaveURL(/\/login/); }
  });

  await check('customer: Q/F/T breakdown, explicit consent by keyboard, and an unavailable service never looks like a payment', async () => {
    await login(customer, 'customer'); await show(customer, `/cliente/trabajos/${jobA}`);
    const form = page.locator('form', { hasText: 'Total a pagar' }); await expect(form).toBeVisible();
    const t = await form.innerText(); assert.match(t, new RegExp('Importe del profesional \\(Q\\)\\s*' + money(25000).source)); assert.match(t, new RegExp('Comisión Fixo \\(F\\)\\s*' + money(1250).source)); assert.match(t, money(26250));
    await expect(page.getByText(/Entorno de prueba: no se realizan cobros reales/)).toBeVisible();
    const box = form.getByRole('checkbox'), button = form.getByRole('button', { name: /Pagar/ });
    await button.focus(); await page.keyboard.press('Enter');                       // no consent: the browser blocks the submission
    assert.equal(await box.evaluate(el => el.validity.valueMissing), true); assert.equal(await form.getByRole('alert').count(), 0);
    await box.focus(); await page.keyboard.press('Space'); await expect(box).toBeChecked();
    await page.keyboard.press('Tab'); await expect(button).toBeFocused(); await page.keyboard.press('Enter');
    await expect(form.getByRole('alert')).toContainText('Los pagos no están disponibles por ahora');
    assert.ok(page.url().includes(jobA) && !page.url().includes('token'));
  });

  await check('a customer who is NOT authorized for Sandbox sees no payment panel and no pay button; revoking mirrors immediately; the database refuses a forged attempt', async () => {
    await db.query('update private.payment_sandbox_accounts set revoked_at=now(),revoked_by=authorized_by where user_id=$1', [actors.customer.id]);
    const step = m => console.log('      · ' + m);
    try {
      step('revoked: loading job page'); await show(customer, `/cliente/trabajos/${jobA}`); step('loaded');
      assert.equal(await page.getByRole('button', { name: /Pagar/ }).count(), 0); assert.equal(await page.getByText('Pagos (Sandbox)').count(), 0); assert.equal(await page.getByText('Total a pagar').count(), 0);
      const policy = (await db.query('select max(version)::int v from private.payment_pricing_policies')).rows[0].v;
      step('forged prepare'); await assert.rejects(() => rpc('customer', 'payment_prepare', { target_job: jobA, target_extra: null, expected_policy_version: policy, consent: true, idempotency_key: randomUUID() }));
      assert.equal((await db.query('select count(*)::int n from private.payment_orders where job_id=$1', [jobA])).rows[0].n, 0);
    } finally { await db.query('update private.payment_sandbox_accounts set revoked_at=null,revoked_by=null where user_id=$1', [actors.customer.id]); }
    step('restored: loading job page'); await show(customer, `/cliente/trabajos/${jobA}`); await expect(page.getByText('Pagos (Sandbox)')).toBeVisible();
  });

  await check('customer list shows the initial payment state per job', async () => {
    await show(customer, '/cliente/trabajos'); const t = await text(); assert.match(t, /Pago inicial pendiente/); assert.match(t, /Pago inicial verificado/);
  });

  await check('technician: sees only the assigned amount Q, no fee/total, no pay controls; payments page says assigned, not transferred', async () => {
    await login(tech, 'technician');
    await show(tech, `/tecnico/trabajos/${jobA}`);                     // no order and the technician is not authorized: the Sandbox panel is simply absent
    assert.equal(await page.getByText('Pagos (Sandbox)').count(), 0); assert.equal(await page.getByRole('button', { name: /Pagar/ }).count(), 0);
    await show(tech, `/tecnico/trabajos/${jobB}`);                     // paid job: the history is visible, with Q only
    await expect(page.getByText('Importe asignado al profesional (Q)')).toBeVisible();
    const t = await text(); assert.ok(!/Comisión Fixo/.test(t) && !/26\.250/.test(t), 'technician sees F/T'); assert.equal(await page.getByRole('button', { name: /Pagar/ }).count(), 0);
    await show(tech, '/tecnico/pagos'); const p = await text();
    assert.match(p, /no son transferencias efectuadas ni saldo disponible para retiro/); assert.match(p, money(25000)); assert.ok(!/26\.250|Comisión/.test(p));
    assert.ok(!/Transferid|Pago recibido|Ingreso recibido/i.test(p));
  });

  await check('a customer who is not a participant sees a not-found screen with no financial data', async () => {
    // Observation: the status is 200 because loading.tsx streams the shell before notFound() renders (pre-existing Sprint 04 behaviour); the CONTENT is what must not leak.
    await login(stranger, 'stranger'); const res = await show(stranger, `/cliente/trabajos/${jobA}`); console.log('  stranger status ' + res.status());
    await expect(page.getByText(/404|no se encontr|no encontr|could not be found/i).first()).toBeVisible();
    const t = await text(); assert.ok(!/Pagos \(Sandbox\)|25\.000|26\.250|Comisión Fixo|Propuesta aceptada/.test(t), 'financial data leaked to a non-participant');
    const html = await page.content(); assert.ok(!/26\.250|25\.000/.test(html), 'amounts present in the HTML of a non-participant');
  });

  await check('paid job: customer sees Pagado; technician proposes an extra; customer accepts with Q/F/T and consent; second extra can be rejected', async () => {
    await show(customer, `/cliente/trabajos/${jobB}`); await expect(page.getByText(/^Pagado( ·|$)/).first()).toBeVisible(); assert.equal(await page.getByRole('button', { name: /Pagar/ }).count(), 0);
    await show(tech, `/tecnico/trabajos/${jobB}`);
    for (const [concept, amount] of [['Reemplazo adicional del sifón y sellos', '20000'], ['Cambio adicional de llave de paso', '8000']]) {
      const f = page.locator('form', { hasText: 'Proponer un adicional' }); await f.getByLabel('Concepto').fill(concept); await f.getByLabel(/Importe en pesos/).fill(amount);
      await f.getByRole('button', { name: 'Proponer adicional' }).click(); await expect(page.getByText(concept)).toBeVisible();
    }
    await show(customer, `/cliente/trabajos/${jobB}`);
    const first = page.locator('section', { hasText: 'Reemplazo adicional del sifón y sellos' });
    const ft = await first.innerText(); assert.match(ft, money(20000)); assert.match(ft, money(1000)); assert.match(ft, money(21000));
    await first.getByLabel(/Acepto este adicional y pagar/).check(); await first.getByRole('button', { name: 'Aceptar adicional' }).click();
    await expect(page.locator('section', { hasText: 'Reemplazo adicional del sifón y sellos' }).getByText('Pago del adicional')).toBeVisible();
    const accepted = page.locator('section', { hasText: 'Reemplazo adicional del sifón y sellos' }); await expect(accepted.getByRole('button', { name: /Pagar/ })).toBeVisible();
    await expect(page.getByText(/importes aceptados pendientes de pago/)).toBeVisible();
    const second = page.locator('section', { hasText: 'Cambio adicional de llave de paso' }); await second.getByRole('button', { name: 'Rechazar' }).click();
    await expect(page.locator('section', { hasText: 'Cambio adicional de llave de paso' }).getByText(/Rechazada/)).toBeVisible();
    assert.equal(await page.locator('section', { hasText: 'Cambio adicional de llave de paso' }).getByRole('button', { name: /Pagar/ }).count(), 0);
    await show(tech, `/tecnico/trabajos/${jobB}`); const tt = await text(); assert.match(tt, /Aceptada/); assert.ok(!/Comisión Fixo|21\.000/.test(tt), 'technician sees the extra F/T');
  });

  await check('mobile (390px): payment screens have no horizontal overflow and keep the actions reachable', async () => {
    const m = await ctx(390, 844); await login(m, 'customer');
    for (const p of [`/cliente/trabajos/${jobA}`, `/cliente/trabajos/${jobB}`, '/cliente/trabajos']) { await show(m, p); await noOverflow(); }
    await show(m, `/cliente/trabajos/${jobA}`); await expect(page.getByRole('button', { name: /Pagar/ })).toBeVisible();
    const mt = await ctx(390, 844); await login(mt, 'technician'); await show(mt, '/tecnico/pagos'); await noOverflow();
    const ma = await ctx(390, 844); await login(ma, 'superadmin'); await show(ma, '/admin/configuracion'); await noOverflow();
  });

  await check('moderator: read-only settings with fee history and pending Flow cost; no edit or re-check controls', async () => {
    await login(moderator, 'moderator'); await show(moderator, '/admin/configuracion');
    await expect(page.getByText('Comisión de Fixo')).toBeVisible(); const t = await text();
    assert.match(t, /5 %/); assert.match(t, /Vista de sólo lectura/); assert.match(t, /Pagado \(coste Flow pendiente\)/);
    assert.equal(await page.getByRole('button', { name: 'Guardar nueva versión' }).count(), 0); assert.equal(await page.getByRole('button', { name: /Reconsultar coste Flow|Solicitar nueva verificación/ }).count(), 0);
    await show(moderator, `/admin/trabajos/${jobB}`); const j = await text(); assert.match(j, /Coste Flow: pendiente de conciliación/); assert.match(j, /Margen de plataforma \(F − G\): pendiente de conciliación/);
    await show(customer, '/admin/configuracion'); await expect(page).toHaveURL(/\/login/);
  });

  await check('superadmin: validates the percentage, previews the effect, creates a versioned change and can only schedule a re-check', async () => {
    await login(superadmin, 'superadmin'); await show(superadmin, '/admin/configuracion');
    const v0 = (await db.query('select max(version)::int v from private.payment_pricing_policies')).rows[0].v;
    const f = page.locator('form', { hasText: 'Cambiar porcentaje de comisión' }), pct = f.getByLabel(/Nuevo porcentaje/), save = f.getByRole('button', { name: 'Guardar nueva versión' });
    await pct.fill('21'); await expect(f.getByRole('alert')).toContainText('porcentaje válido'); await expect(save).toBeDisabled();
    await pct.fill('5,25'); await expect(f.getByText(/Ejemplo:/)).toContainText('$105.250'); await expect(save).toBeEnabled();
    await f.getByLabel(/Motivo/).fill('Ajuste comercial de prueba del navegador'); await f.getByLabel(/Confirmo que este porcentaje/).check(); await save.click();
    await expect(page.getByText(`versión ${v0 + 1}`).first()).toBeVisible(); await expect(page.getByText('5,25 %').first()).toBeVisible(); await expect(page.getByText('Ajuste comercial de prueba del navegador').first()).toBeVisible();
    const jobAfter = (await db.query("select fee_basis_points from private.payment_orders where job_id=$1 and origin='initial'", [jobB])).rows[0].fee_basis_points; assert.equal(jobAfter, 500, 'existing orders keep their frozen rate');
    const re = page.getByRole('button', { name: 'Reconsultar coste Flow' }).first(); await re.click(); await expect(page.getByText(/Verificación programada/)).toBeVisible();
    assert.equal((await db.query("select state from private.payment_attempts a join private.payment_orders o on o.id=a.order_id where o.job_id=$1 and origin='initial'", [jobB])).rows[0].state, 'paid', 'a re-check never changes the payment');
  });

  await check('return and confirmation routes never echo or act on a token; Fixo URLs and the browser never leave loopback', async () => {
    const secret = 'TOKEN-' + randomBytes(8).toString('hex'), api = anonymous.request;
    const r = await api.post(origin + '/api/payments/flow/return', { form: { token: secret }, maxRedirects: 0 });
    assert.equal(r.status(), 303); assert.equal(new URL(r.headers().location, origin).pathname, '/cliente/trabajos'); assert.ok(!r.headers().location.includes(secret)); assert.ok(!(await r.text()).includes(secret));
    const c = await api.post(origin + '/api/payments/flow/confirmation', { form: { token: secret }, maxRedirects: 0 });
    assert.equal(c.status(), 503); assert.ok(!(await c.text()).includes(secret)); assert.equal((await api.get(origin + '/api/payments/flow/confirmation')).status(), 405);
    assert.equal((await db.query('select count(*)::int n from private.payment_inbox')).rows[0].n, 0, 'disabled notifications persist nothing');
    const allowedPorts = new Set([String(PORT), new URL(url).port]); // the app itself and the local Supabase (browser-side auth)
    const foreign = [...requested].filter(o => { const u = new URL(o); return !loopback(o) || !allowedPorts.has(u.port); });
    assert.deepEqual(foreign, [], 'the browser contacted something other than the local app/Supabase'); assert.ok(!fixoUrls.some(u => /token=/i.test(u)), 'token in a Fixo URL');
    assert.deepEqual(pageErrors, []);
  });

  await mkdir('docs/production/sprint-05-evidence', { recursive: true });
  await writeFile('docs/production/sprint-05-evidence/browser-local.json', JSON.stringify({ status: 'PASS local (Chrome headless, stack local aislado, sin Flow)', checks, desktop: true, mobile: true, keyboard: true, origins: [...requested] }, null, 2));
  console.log(JSON.stringify({ status: 'PASS local', checks: checks.length }));
} catch (error) {
  await page?.screenshot({ path: join(tmpdir(), 'fixo-browser-failure.png'), fullPage: true, timeout: 5000 }).catch(() => {});
  console.error('FAILED after: ' + (checks.at(-1) ?? '(none)')); throw error;
} finally {
  await browser?.close();
  if (server?.pid) { if (process.platform === 'win32') spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' }); else server.kill(); }
  await db?.end();
}
