// Diagnostic ONLY: sends one signed payment/create to the fixed Flow SANDBOX API. A successful call CREATES an order inside Flow (outside any Fixo row), so the
// reference is persisted in the MANIFEST *before* sending and completed with a validated classification: `created` (token + flowOrder), `refused` (a documented
// definitive 400/401 {code,message}) or `ambiguous` (anything else, incl. lost answers, 5xx and unexpected 200 bodies — Flow may have created it; recover with
// `reconcile-external.mjs external <commerceOrder>`). The payer address must be the configured Sandbox one or a synthetic .invalid one. Requires FIXO_FLOW_SANDBOX_REMOTE.
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PROJECT_REF, readManifest, stamp, writeManifest } from './lib.mjs';
import { assertAllowedPayer, classifyCreate } from './logic.mjs';

assert.equal(process.env.FIXO_FLOW_SANDBOX_REMOTE, PROJECT_REF);
const text = await readFile(resolve('.env.local'), 'utf8'); const env = {};
for (const line of text.split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(line); if (m) env[m[1]] = m[2].trim().replace(/^"|"$/g, ''); }
assert.ok(env.FLOW_API_KEY && env.FLOW_SECRET_KEY && env.FIXO_FLOW_CALLBACK_ORIGIN);
const email = assertAllowedPayer(process.argv[2], env.FIXO_FLOW_SANDBOX_PAYER_EMAIL), origin = process.argv[3] ?? env.FIXO_FLOW_CALLBACK_ORIGIN;
const manifest = await readManifest(); assert.ok(manifest, 'sin manifiesto');
const commerceOrder = `fixo-sbx-${randomUUID().replaceAll('-', '')}`;
const entry = { at: stamp(), kind: 'diagnose-create', commerceOrder, payerDomain: email.split('@')[1], state: 'sending', note: 'Diagnóstico fuera de Fixo: si Flow la creó, existe una orden Sandbox sin fila local y nunca se paga.' };
(manifest.externalOrders ??= []).push(entry); await writeManifest(manifest);                      // persisted BEFORE the request
const params = { amount: '26250', apiKey: env.FLOW_API_KEY, commerceOrder, currency: 'CLP', email, subject: 'Prueba Fixo Sandbox', urlConfirmation: `${origin}/api/payments/flow/confirmation`, urlReturn: `${origin}/api/payments/flow/return` };
const s = createHmac('sha256', env.FLOW_SECRET_KEY).update(Object.keys(params).sort().map(k => k + params[k]).join(''), 'utf8').digest('hex');
let outcome;
try {
  const res = await fetch('https://sandbox.flow.cl/api/payment/create', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ...params, s }).toString(), redirect: 'error' });
  outcome = classifyCreate({ http: res.status, bodyText: await res.text() });
} catch (error) { outcome = classifyCreate({ networkError: error }); }
const again = await readManifest(); Object.assign(again.externalOrders.find(e => e.commerceOrder === commerceOrder), outcome, { completedAt: stamp() }); await writeManifest(again);
console.log(JSON.stringify({ commerceOrder, ...outcome }));
