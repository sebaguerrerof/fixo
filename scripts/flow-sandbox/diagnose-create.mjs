// Diagnostic ONLY: sends one signed payment/create to the fixed Flow SANDBOX API and prints Flow's answer (HTTP status and the documented {code,message}
// error body — never credentials or tokens). Because a successful call CREATES an order inside Flow (outside any Fixo row), the reference is persisted in the
// MANIFEST *before* sending and completed with the result (flowOrder, error code, or "ambiguous" if the answer is lost). Requires FIXO_FLOW_SANDBOX_REMOTE.
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PROJECT_REF, readManifest, stamp, writeManifest } from './lib.mjs';

assert.equal(process.env.FIXO_FLOW_SANDBOX_REMOTE, PROJECT_REF);
const text = await readFile(resolve('.env.local'), 'utf8'); const env = {};
for (const line of text.split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(line); if (m) env[m[1]] = m[2].trim().replace(/^"|"$/g, ''); }
assert.ok(env.FLOW_API_KEY && env.FLOW_SECRET_KEY && env.FIXO_FLOW_CALLBACK_ORIGIN);
const email = process.argv[2], origin = process.argv[3] ?? env.FIXO_FLOW_CALLBACK_ORIGIN;
assert.ok(email && !email.toLowerCase().endsWith('@gmail.com') || email === env.FIXO_FLOW_SANDBOX_PAYER_EMAIL, 'use sólo la dirección configurada como pagador de Sandbox o un correo sintético (nunca la dirección de un tercero)');
const manifest = await readManifest(); assert.ok(manifest, 'sin manifiesto');
const commerceOrder = `fixo-sbx-${randomUUID().replaceAll('-', '')}`;
const entry = { at: stamp(), kind: 'diagnose-create', commerceOrder, payerDomain: email.split('@')[1], state: 'sending', note: 'Diagnóstico fuera de Fixo: si Flow la creó, existe una orden Sandbox sin fila local y nunca se paga.' };
(manifest.externalOrders ??= []).push(entry); await writeManifest(manifest);                      // persisted BEFORE the request
const params = { amount: '26250', apiKey: env.FLOW_API_KEY, commerceOrder, currency: 'CLP', email, subject: 'Prueba Fixo Sandbox', urlConfirmation: `${origin}/api/payments/flow/confirmation`, urlReturn: `${origin}/api/payments/flow/return` };
const s = createHmac('sha256', env.FLOW_SECRET_KEY).update(Object.keys(params).sort().map(k => k + params[k]).join(''), 'utf8').digest('hex');
let outcome;
try {
  const res = await fetch('https://sandbox.flow.cl/api/payment/create', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ...params, s }).toString(), redirect: 'error' });
  const body = await res.text(); let j; try { j = JSON.parse(body); } catch { j = null; }
  outcome = j?.token ? { state: 'created', http: res.status, flowOrder: String(j.flowOrder) } : { state: 'refused', http: res.status, code: j?.code ?? null, message: j?.message ?? body.slice(0, 200) };
} catch (error) { outcome = { state: 'ambiguous', error: String(error?.name ?? 'error') }; }   // the answer was lost: Flow may have created it; reconcile by commerceOrder
Object.assign(entry, outcome, { completedAt: stamp() });
const again = await readManifest(); again.externalOrders.find(e => e.commerceOrder === commerceOrder).state = entry.state; Object.assign(again.externalOrders.find(e => e.commerceOrder === commerceOrder), outcome, { completedAt: entry.completedAt }); await writeManifest(again);
console.log(JSON.stringify({ commerceOrder, ...outcome }));
