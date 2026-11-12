// One-off DATA CORRECTION of the run's SYNTHETIC paid orders after the owner decided that the Flow cost G includes taxes (fee + taxes).
// For each paid attempt listed in the manifest it queries Flow (signed getStatusByFlowOrder), applies the SHIPPED rule (`flowCost`, parity-tested against the
// application), and updates ONLY `flow_cost_clp` of that order (by UUID, only if the order is paid by that attempt and the value differs). Old/new values go to
// the manifest. Nothing else is touched (the amounts, states and events are append-only/immutable). Requires FIXO_FLOW_SANDBOX_REMOTE.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PROJECT_REF, lit, readManifest, sql, stamp, writeManifest } from './lib.mjs';
import { flowCost } from './logic.mjs';

assert.equal(process.env.FIXO_FLOW_SANDBOX_REMOTE, PROJECT_REF);
const m = await readManifest(); assert.ok(m?.orders?.length, 'sin órdenes en el manifiesto (ejecute reconcile-external.mjs financial)');
const env = {}; for (const line of (await readFile(resolve('.env.local'), 'utf8')).split(/\r?\n/)) { const x = /^([A-Z0-9_]+)=(.*)$/.exec(line); if (x) env[x[1]] = x[2].trim().replace(/^"|"$/g, ''); }
const ids = m.orders.map(o => lit(o.id)).join(',');
const rows = await sql(`select o.id, o.total_clp::int total, o.flow_cost_clp::int cost, a.flow_order::text flow_order, a.commerce_order from private.payment_orders o join private.payment_attempts a on a.id=o.paid_attempt_id where o.id in (${ids}) and o.status='paid' order by o.created_at`);
const changes = [];
for (const r of rows) {
  const params = { apiKey: env.FLOW_API_KEY, flowOrder: r.flow_order };
  const s = createHmac('sha256', env.FLOW_SECRET_KEY).update(Object.keys(params).sort().map(k => k + params[k]).join(''), 'utf8').digest('hex');
  const res = await fetch('https://sandbox.flow.cl/api/payment/getStatusByFlowOrder?' + new URLSearchParams({ ...params, s }).toString()); const j = await res.json();
  assert.equal(res.status, 200); assert.equal(j.commerceOrder, r.commerce_order, 'identidad: la referencia no coincide'); assert.equal(String(j.flowOrder), r.flow_order); assert.equal(Number(j.status), 2);
  assert.equal(Number(j.amount), r.total, 'el monto de Flow no coincide con el total de la orden');
  const cost = flowCost(j.amount, j.paymentData); assert.ok(cost !== null, 'coste desconocido para ' + r.id);
  if (cost !== r.cost) { await sql(`update private.payment_orders set flow_cost_clp=${cost} where id=${lit(r.id)} and status='paid' and flow_cost_clp is not distinct from ${r.cost === null ? 'null' : r.cost}`); changes.push({ order: r.id, flowOrderTail: r.flow_order.slice(-4), from: r.cost, to: cost, fee: j.paymentData.fee, taxes: j.paymentData.taxes, balance: j.paymentData.balance }); }
}
const after = await sql(`select id, flow_cost_clp::int cost from private.payment_orders where id in (${ids}) and status='paid' order by created_at`);
m.notes.push(`${stamp()} corrección de datos sintéticos: coste Flow = fee + impuestos (decisión del propietario); ${changes.length} órdenes actualizadas (${JSON.stringify(changes.map(c => [c.from, c.to]))})`);
(m.costCorrections ??= []).push({ at: stamp(), rule: 'fee + taxes, cross-checked with balance', changes }); await writeManifest(m);
console.log(JSON.stringify({ checked: rows.length, updated: changes.length, costsAfter: after.map(a => a.cost) }));
