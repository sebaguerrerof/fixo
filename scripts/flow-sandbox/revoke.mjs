// Revokes the Sandbox authorization of the run's synthetic customer through the real superadmin RPC (history event recorded). Part of the run's closure.
import assert from 'node:assert/strict';
import { PROJECT_REF, actorClient, loadEnv, readManifest, readSecrets, rpc, stamp, writeManifest } from './lib.mjs';
assert.equal(process.env.FIXO_FLOW_SANDBOX_REMOTE, PROJECT_REF);
const env = await loadEnv(), secrets = await readSecrets(), m = await readManifest(); assert.ok(m && m.accounts.customer);
const sup = await actorClient(env, secrets, 'superadmin');
const r = await rpc(sup, 'payment_sandbox_account_set', { target_user: m.accounts.customer.id, enabled: false, change_reason: `Cierre de la fase C (${m.run}): fin de la ventana de pruebas Sandbox` });
m.notes.push(`${stamp()} autorización Sandbox del cliente sintético revocada (enabled=${r.enabled})`); await writeManifest(m); console.log(JSON.stringify(r));
