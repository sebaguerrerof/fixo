// Diagnostic ONLY: sends one signed payment/create to the fixed Flow SANDBOX API with a throw-away reference and prints Flow's answer
// (HTTP status and the documented {code,message} error body — never the credentials). Used to learn why Flow refused a creation.
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const text = await readFile(resolve('.env.local'), 'utf8'); const env = {};
for (const line of text.split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(line); if (m) env[m[1]] = m[2].trim().replace(/^"|"$/g, ''); }
assert.ok(env.FLOW_API_KEY && env.FLOW_SECRET_KEY && env.FIXO_FLOW_CALLBACK_ORIGIN);
const email = process.argv[2] ?? 'sintetico@sandbox.fixo.invalid', origin = process.argv[3] ?? env.FIXO_FLOW_CALLBACK_ORIGIN;
const params = { amount: '26250', apiKey: env.FLOW_API_KEY, commerceOrder: `fixo-sandbox-${randomUUID()}`, currency: 'CLP', email, subject: 'Prueba Fixo Sandbox', urlConfirmation: `${origin}/api/payments/flow/confirmation`, urlReturn: `${origin}/api/payments/flow/return` };
const s = createHmac('sha256', env.FLOW_SECRET_KEY).update(Object.keys(params).sort().map(k => k + params[k]).join(''), 'utf8').digest('hex');
const res = await fetch('https://sandbox.flow.cl/api/payment/create', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ...params, s }).toString(), redirect: 'error' });
const body = await res.text();
let shown; try { const j = JSON.parse(body); shown = j.token ? { url: j.url, flowOrder: j.flowOrder, token: '(omitido)' } : j; } catch { shown = body.slice(0, 300); }
console.log(JSON.stringify({ status: res.status, email, origin, body: shown }));
