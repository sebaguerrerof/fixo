// Manifest bookkeeping for the remote run. Modes:
//   financial                              dump the UUID relationships of the financial rows Fixo created for the manifest jobs
//   external <commerceOrder> [flowOrder]   query Flow (signed getStatusByFlowOrder when the flowOrder is known, otherwise getStatusByCommerceId) for ONE recorded
//                                          external order, validate HTTP, structure and IDENTITY against the recorded entry and store an explicit classification
//                                          (pending | paid | rejected | cancelled | unknown). Pending, paid and unknown stay OPEN for the closure (see `issues`).
//   issues                                 list the external orders that still block considering the run closed
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PROJECT_REF, readManifest, sql, stamp, withManifestLock, writeManifest } from './lib.mjs';
import { applyClosure, classifyReconciliation, openExternalIssues } from './logic.mjs';

assert.equal(process.env.FIXO_FLOW_SANDBOX_REMOTE, PROJECT_REF);
const mode = process.argv[2];
await withManifestLock(async () => {   // exclusive over the manifest from the first read to the last write
const m = await readManifest(); assert.ok(m);
if (mode === 'financial') {
  const jobs = m.jobs.map(j => `'${j.id}'`).join(',');
  m.orders = await sql(`select o.id,o.job_id,o.origin,o.extra_charge_id,o.status,o.review_reason,o.professional_amount_clp,o.platform_fee_clp,o.total_clp,o.flow_cost_clp,o.paid_attempt_id from private.payment_orders o where o.job_id in (${jobs}) order by o.created_at`);
  m.attempts = await sql(`select a.id,a.order_id,a.commerce_order,a.flow_order::text flow_order,a.state,a.error_code from private.payment_attempts a join private.payment_orders o on o.id=a.order_id where o.job_id in (${jobs}) order by a.created_at`);
  m.events = await sql(`select e.id,e.order_id,e.attempt_id,e.validation,e.observed_status from private.payment_events e join private.payment_orders o on o.id=e.order_id where o.job_id in (${jobs}) order by e.observed_at,e.id`);
  m.inbox = await sql(`select i.id,i.state,i.generation,i.processed_generation,i.quarantine_reason from private.payment_inbox i order by i.first_received_at`);
  m.financialRecordedAt = stamp(); await writeManifest(m); console.log(JSON.stringify({ orders: m.orders.length, attempts: m.attempts.length, events: m.events.length, inbox: m.inbox.length }));
} else if (mode === 'external') {
  const [commerceOrder, givenFlowOrder] = process.argv.slice(3); assert.match(commerceOrder ?? '', /^fixo-sbx-[0-9a-f]{32}$/);
  const entry = (m.externalOrders ?? []).find(e => e.commerceOrder === commerceOrder); assert.ok(entry, 'la referencia no está registrada como orden externa del manifiesto (identidad)');
  const flowOrder = givenFlowOrder ?? entry.flowOrder ?? null; if (flowOrder) assert.match(String(flowOrder), /^[0-9]{5,12}$/);
  const env = {}; for (const line of (await readFile(resolve('.env.local'), 'utf8')).split(/\r?\n/)) { const x = /^([A-Z0-9_]+)=(.*)$/.exec(line); if (x) env[x[1]] = x[2].trim().replace(/^"|"$/g, ''); }
  const params = flowOrder ? { apiKey: env.FLOW_API_KEY, flowOrder: String(flowOrder) } : { apiKey: env.FLOW_API_KEY, commerceId: commerceOrder };
  const s = createHmac('sha256', env.FLOW_SECRET_KEY).update(Object.keys(params).sort().map(k => k + params[k]).join(''), 'utf8').digest('hex');
  let answer;
  try {
    const res = await fetch(`https://sandbox.flow.cl/api/payment/${flowOrder ? 'getStatusByFlowOrder' : 'getStatusByCommerceId'}?` + new URLSearchParams({ ...params, s }).toString());
    let json = null; try { json = await res.json(); } catch { json = null; }
    answer = { http: res.status, json };
  } catch (error) { answer = { networkError: error }; }
  const result = { at: stamp(), via: flowOrder ? 'flowOrder' : 'commerceOrder', ...classifyReconciliation({ commerceOrder, flowOrder }, answer) };
  entry.reconciliation = result; (entry.reconciliations ??= []).push(result);
  if (result.flowOrder && !entry.flowOrder) entry.flowOrder = result.flowOrder;
  applyClosure(m, stamp());                       // a new reconciliation can never leave a stale closure
  await writeManifest(m); console.log(JSON.stringify({ commerceOrder, ...result }));
} else if (mode === 'issues') {
  console.log(JSON.stringify(openExternalIssues(m)));
} else if (mode === 'close') {
  // Definitive financial closure: allowed only after retention and with NO open external issue.
  const state = applyClosure(m, stamp(), { closing: true }); await writeManifest(m);
  console.log(JSON.stringify({ state, openExternalIssues: openExternalIssues(m) })); process.exitCode = state === 'closed-retained' ? 0 : 3;
}
});
