// One-off DATA CORRECTION of the run's SYNTHETIC paid orders after the owner decided that the Flow cost G includes taxes (fee + taxes).
// Durable and idempotent (see recost-core.mjs): an intent with the old and new value is written to the manifest BEFORE each update, each update is confirmed with
// `UPDATE ... RETURNING`, and a rerun after an interruption recovers instead of losing the previous value. Only `flow_cost_clp` of manifest orders is touched, by UUID.
// The new value comes from Flow (signed getStatusByFlowOrder) through the SHIPPED rule (`flowCost`, parity-tested). Requires FIXO_FLOW_SANDBOX_REMOTE.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PROJECT_REF, lit, lockManifest, readManifest, sql, writeManifest } from './lib.mjs';
import { flowCost } from './logic.mjs';
import { runCostCorrection } from './recost-core.mjs';

assert.equal(process.env.FIXO_FLOW_SANDBOX_REMOTE, PROJECT_REF);
const m0 = await readManifest(); assert.ok(m0?.orders?.length, 'sin órdenes en el manifiesto (ejecute reconcile-external.mjs financial)');
const env = {}; for (const line of (await readFile(resolve('.env.local'), 'utf8')).split(/\r?\n/)) { const x = /^([A-Z0-9_]+)=(.*)$/.exec(line); if (x) env[x[1]] = x[2].trim().replace(/^"|"$/g, ''); }
const ids = m0.orders.map(o => lit(o.id)).join(',');
const rows = (await sql(`select o.id, o.total_clp::int total, o.flow_cost_clp::int cost, a.flow_order::text flow_order, a.commerce_order from private.payment_orders o join private.payment_attempts a on a.id=o.paid_attempt_id where o.id in (${ids}) and o.status='paid' order by o.created_at`));
const byId = new Map(rows.map(r => [r.id, r]));
const summary = await runCostCorrection({
  rows: rows.map(r => ({ id: r.id, cost: r.cost })),
  readCost: async id => (await sql(`select flow_cost_clp::int cost from private.payment_orders where id=${lit(id)}`))[0].cost,
  getCost: async ({ id }) => {
    const r = byId.get(id), params = { apiKey: env.FLOW_API_KEY, flowOrder: r.flow_order };
    const s = createHmac('sha256', env.FLOW_SECRET_KEY).update(Object.keys(params).sort().map(k => k + params[k]).join(''), 'utf8').digest('hex');
    const res = await fetch('https://sandbox.flow.cl/api/payment/getStatusByFlowOrder?' + new URLSearchParams({ ...params, s }).toString()); const j = await res.json();
    assert.equal(res.status, 200); assert.equal(j.commerceOrder, r.commerce_order, 'identidad: la referencia no coincide'); assert.equal(String(j.flowOrder), r.flow_order); assert.equal(Number(j.status), 2);
    assert.equal(Number(j.amount), r.total, 'el monto de Flow no coincide con el total de la orden');
    return flowCost(j.amount, j.paymentData);
  },
  applyUpdate: (id, from, to) => sql(`update private.payment_orders set flow_cost_clp=${to} where id=${lit(id)} and status='paid' and flow_cost_clp is not distinct from ${from === null ? 'null' : from} returning flow_cost_clp::int`),
  load: readManifest, save: writeManifest, lock: lockManifest,
});
console.log(JSON.stringify(summary));
