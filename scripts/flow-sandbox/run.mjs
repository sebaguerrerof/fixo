// REMOTE Flow Sandbox run (phase C). Commands: setup | job <label> | status | (more are added per scenario).
// It refuses to run unless FIXO_FLOW_SANDBOX_REMOTE=rjzyqdhotcshvbdcrgon (explicit, per invocation) and only ever touches the manifest's synthetic ids.
import assert from 'node:assert/strict';
import { PROJECT_REF, loadEnv, readManifest, sql } from './lib.mjs';
import { createJob, retireCriterion, setup } from './fixtures.mjs';

assert.equal(process.env.FIXO_FLOW_SANDBOX_REMOTE, PROJECT_REF, `defina FIXO_FLOW_SANDBOX_REMOTE=${PROJECT_REF} para confirmar el destino remoto`);
const [cmd, ...args] = process.argv.slice(2), env = await loadEnv();
if (cmd === 'setup') { const m = await setup(env); console.log(JSON.stringify({ run: m.run, accounts: Object.keys(m.accounts), criterion: !!m.criterion })); }
else if (cmd === 'job') { const j = await createJob(env, args[0] ?? 'trabajo'); console.log(JSON.stringify(j)); }
else if (cmd === 'retire-criterion') console.log(JSON.stringify(await retireCriterion()));
else if (cmd === 'status') {
  const m = await readManifest(); console.log(JSON.stringify({ run: m?.run, state: m?.state, jobs: m?.jobs.length, orders: m?.orders.length }));
  console.log(JSON.stringify(await sql(`select (select count(*)::int from auth.users) users,(select count(*)::int from private.payment_orders) orders,(select count(*)::int from private.payment_attempts) attempts,(select count(*)::int from private.payment_events) events,(select count(*)::int from private.payment_inbox) inbox`)));
} else { console.error('comando desconocido'); process.exit(2); }
