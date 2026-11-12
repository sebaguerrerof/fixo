// Phase D, option 1 ("retención etiquetada"): the financial rows are append-only and stay, identified by the manifest. What this command does is make the synthetic
// accounts INERT and invisible: the synthetic technician leaves the public directory (status 'suspended'), the three profiles are suspended, their Auth users are
// banned and their sessions removed. Only the manifest's account ids are touched; nothing is deleted. Requires FIXO_FLOW_SANDBOX_REMOTE.
import assert from 'node:assert/strict';
import { PROJECT_REF, loadEnv, lit, readManifest, serviceClient, sql, stamp, writeManifest } from './lib.mjs';
import { closureState, openExternalIssues } from './logic.mjs';

assert.equal(process.env.FIXO_FLOW_SANDBOX_REMOTE, PROJECT_REF);
const env = await loadEnv(), m = await readManifest(); assert.ok(m && m.accounts && m.state !== 'cleaned');
const ids = Object.values(m.accounts).map(a => a.id); assert.equal(ids.length, 3);
const list = ids.map(lit).join(',');
const emails = await sql(`select id::text, email from auth.users where id in (${list})`);
assert.equal(emails.length, 3); assert.ok(emails.every(u => u.email.endsWith('.invalid') && u.email.startsWith(m.run)), 'sólo las cuentas sintéticas del manifiesto');
await sql(`update public.technician_profiles set status='suspended' where user_id=${lit(m.accounts.technician.id)};
update public.profiles set account_status='suspended' where id in (${list});
delete from auth.sessions where user_id in (${list});`);
const admin = serviceClient(env);
for (const id of ids) { const r = await admin.auth.admin.updateUserById(id, { ban_duration: '876000h' }); assert.equal(r.error, null, 'ban ' + id + ': ' + r.error?.message); }
const [after] = await sql(`select (select count(*)::int from public.technician_profiles where status in ('verified','active')) public_technicians,
 (select count(*)::int from public.profiles where id in (${list}) and account_status='active') active_synthetic_profiles,
 (select count(*)::int from auth.users where id in (${list}) and banned_until is not null and banned_until>now()) banned,
 (select count(*)::int from auth.sessions where user_id in (${list})) sessions,
 (select count(*)::int from private.payment_sandbox_accounts where revoked_at is null) active_authorizations`);
assert.deepEqual(after, { public_technicians: 0, active_synthetic_profiles: 0, banned: 3, sessions: 0, active_authorizations: 0 });
// Retention is NOT the financial closure: the run is only `closed-retained` when no external order is left open (pending, paid outside Fixo, unknown, ambiguous, unreconciled).
m.retainedAt = stamp(); m.state = closureState(m); const issues = openExternalIssues(m);
m.notes.push(`${stamp()} fase D (retención etiquetada): cuentas sintéticas suspendidas y vetadas, técnico fuera del directorio público, sesiones eliminadas, autorizaciones Sandbox 0; las filas financieras se conservan (append-only) identificadas por este manifiesto. Estado: ${m.state}${issues.length ? ` (${issues.length} asunto(s) externo(s) abierto(s))` : ''}`);
await writeManifest(m); console.log(JSON.stringify({ ...after, state: m.state, openExternalIssues: issues.length }));
