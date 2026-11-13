// Diagnostic: signed getStatusByFlowOrder for the PAID attempt of one manifest job; prints the response SHAPE (keys) and the documented numeric fields only.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PROJECT_REF, lit, readManifest, sql } from './lib.mjs';

assert.equal(process.env.FIXO_FLOW_SANDBOX_REMOTE, PROJECT_REF); const job = process.argv[2];
const m = await readManifest(); assert.ok(m.jobs.some(j => j.id === job));
const [row] = await sql(`select a.flow_order::text fo from private.payment_attempts a join private.payment_orders o on o.id=a.order_id where o.job_id=${lit(job)} and a.state='paid' limit 1`);
const env = {}; for (const line of (await readFile(resolve('.env.local'), 'utf8')).split(/\r?\n/)) { const x = /^([A-Z0-9_]+)=(.*)$/.exec(line); if (x) env[x[1]] = x[2].trim().replace(/^"|"$/g, ''); }
const params = { apiKey: env.FLOW_API_KEY, flowOrder: row.fo };
const s = createHmac('sha256', env.FLOW_SECRET_KEY).update(Object.keys(params).sort().map(k => k + params[k]).join(''), 'utf8').digest('hex');
const res = await fetch('https://sandbox.flow.cl/api/payment/getStatusByFlowOrder?' + new URLSearchParams({ ...params, s }).toString());
const j = await res.json();
const pd = j.paymentData ?? null;
console.log(JSON.stringify({ http: res.status, keys: Object.keys(j), status: j.status, amount: j.amount, currency: j.currency, paymentDataKeys: pd ? Object.keys(pd) : null, fee: pd?.fee ?? null, balance: pd?.balance ?? null, media: pd?.media ?? null }));
