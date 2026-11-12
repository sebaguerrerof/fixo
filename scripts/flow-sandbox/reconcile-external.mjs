// Records, in the MANIFEST, the Flow-side state of an order created OUTSIDE Fixo by a diagnostic call, and (for the financial rows Fixo created) the full
// UUID relationships. Read-only against Flow (signed getStatusByFlowOrder); the manifest is the only thing written.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PROJECT_REF, readManifest, sql, stamp, writeManifest } from './lib.mjs';

assert.equal(process.env.FIXO_FLOW_SANDBOX_REMOTE, PROJECT_REF);
const mode = process.argv[2], m = await readManifest(); assert.ok(m);
if (mode === 'financial') {
  const jobs = m.jobs.map(j => `'${j.id}'`).join(',');
  m.orders = await sql(`select o.id,o.job_id,o.origin,o.extra_charge_id,o.status,o.review_reason,o.professional_amount_clp,o.platform_fee_clp,o.total_clp,o.flow_cost_clp,o.paid_attempt_id from private.payment_orders o where o.job_id in (${jobs}) order by o.created_at`);
  m.attempts = await sql(`select a.id,a.order_id,a.commerce_order,a.flow_order::text flow_order,a.state,a.error_code from private.payment_attempts a join private.payment_orders o on o.id=a.order_id where o.job_id in (${jobs}) order by a.created_at`);
  m.events = (await sql(`select e.id,e.order_id,e.attempt_id,e.validation,e.observed_status from private.payment_events e join private.payment_orders o on o.id=e.order_id where o.job_id in (${jobs}) order by e.observed_at,e.id`));
  m.inbox = await sql(`select i.id,i.state,i.generation,i.processed_generation,i.quarantine_reason from private.payment_inbox i order by i.first_received_at`);
  m.financialRecordedAt = stamp(); await writeManifest(m); console.log(JSON.stringify({ orders: m.orders.length, attempts: m.attempts.length, events: m.events.length, inbox: m.inbox.length }));
} else if (mode === 'external') {
  const flowOrder = process.argv[3]; assert.match(flowOrder, /^[0-9]{5,12}$/);
  const env = {}; for (const line of (await readFile(resolve('.env.local'), 'utf8')).split(/\r?\n/)) { const x = /^([A-Z0-9_]+)=(.*)$/.exec(line); if (x) env[x[1]] = x[2].trim().replace(/^"|"$/g, ''); }
  const params = { apiKey: env.FLOW_API_KEY, flowOrder };
  const s = createHmac('sha256', env.FLOW_SECRET_KEY).update(Object.keys(params).sort().map(k => k + params[k]).join(''), 'utf8').digest('hex');
  const res = await fetch('https://sandbox.flow.cl/api/payment/getStatusByFlowOrder?' + new URLSearchParams({ ...params, s }).toString()); const j = await res.json();
  const entry = { reconciledAt: stamp(), flowOrder, http: res.status, commerceOrder: j.commerceOrder ?? null, flowStatus: j.status ?? null, amount: j.amount ?? null, currency: j.currency ?? null, paidAtFixo: false, note: 'Creada por diagnose-create.mjs fuera de Fixo (sin fila local); nunca se abrió su checkout; no hay pago.' };
  (m.externalOrders ??= []).push(entry); await writeManifest(m); console.log(JSON.stringify(entry));
}
