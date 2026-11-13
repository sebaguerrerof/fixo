// Real PostgreSQL tests of the privilege snapshot/reconcile tools (scripts/backup/). Uses the same embedded PostgreSQL as the other suites; nothing remote is contacted.
// A "source" database defines the reference privileges; "target" databases are built to differ in exactly one way each.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import EmbeddedPostgres from '../.audit-backups/tooling/sprint03-postgres/node_modules/embedded-postgres/dist/index.js';
import { SNAPSHOT_SQL, buildReconcileSql, buildSnapshotDoc } from './backup/privileges-lib.mjs';

const root = resolve('.audit-backups/privilege-postgres', randomUUID());
await mkdir(root, { recursive: true });
const logs = [];
const server = new EmbeddedPostgres({ databaseDir: resolve(root, 'data'), port: 54405, user: 'postgres', password: randomBytes(32).toString('hex'),
  persistent: true, createPostgresUser: false, authMethod: 'scram-sha-256', initdbFlags: ['--encoding=UTF8', '--locale=C'],
  postgresFlags: ['-c', 'listen_addresses=127.0.0.1', '-c', 'max_connections=20', '-c', 'shared_buffers=32MB'], onLog: m => logs.push(String(m)), onError: m => logs.push(String(m)) });
let admin; const clients = []; let passed = 0;
const check = async (name, fn) => { await fn(); passed++; console.log('PASS ' + name); };
const PROJECT = 'abcdefghij0123456789';

/** Reference objects. `widen` makes the database grant more by default (what a fresh Supabase project does); `variant` tweaks ONE thing. */
const baseObjects = `
  create schema if not exists private;
  create table public.jobs(id int primary key, note text);
  create table private.orders(id int primary key);
  create view public.jobs_view as select id from public.jobs;
  create sequence public.job_seq;
  create function public.job_detail(x int) returns int language sql security definer as $$ select x $$;
  create function private.internal_step(a text, b jsonb) returns text language sql as $$ select a $$;
  revoke all on function public.job_detail(int), private.internal_step(text, jsonb) from public;
  grant execute on function public.job_detail(int) to authenticated;
  grant usage on schema public to anon, authenticated, service_role;
  grant usage on schema private to service_role;
  grant select on public.jobs to authenticated;
  grant select, insert on public.jobs to service_role;
  grant select on public.jobs_view to authenticated;
  grant usage on sequence public.job_seq to authenticated;`;

async function makeDb(name, { widen = false, extra = '' } = {}) {
  await admin.query(`create database ${name}`);
  const c = server.getPgClient(name, '127.0.0.1'); await c.connect(); clients.push(c);
  await c.query(`revoke all on schema public from public`);
  if (widen) await c.query(`alter default privileges in schema public grant all on tables to anon, authenticated; alter default privileges in schema public grant execute on functions to anon, authenticated, service_role; alter default privileges in schema public grant all on sequences to anon, authenticated`);
  await c.query(baseObjects + extra);
  return c;
}
async function snapshotOf(client) {
  await client.query(`select set_config('search_path', 'pg_catalog', false)`);
  const { rows } = await client.query(SNAPSHOT_SQL.split(';\n')[1]);          // the query itself, after the search_path fix (done above on this session)
  await client.query(`reset search_path`);
  return buildSnapshotDoc(rows, { project: PROJECT, takenAt: '2026-11-13T12:00:00.000Z' });
}
/** Runs a generated script. Returns { ok, message }; after a failure the aborted transaction is rolled back like an operator would. */
async function run(client, sql) {
  try { await client.query(sql); return { ok: true }; }
  catch (error) { await client.query('rollback').catch(() => {}); return { ok: false, message: String(error.message) }; }
}
const verify = (client, doc, opts = {}) => run(client, buildReconcileSql(doc, { verifyOnly: true, ...opts }));
const reconcile = (client, doc, opts = {}) => run(client, buildReconcileSql(doc, opts));
const privilege = async (client, sql) => (await client.query(sql)).rows[0].v;

try {
  await server.initialise(); await server.start(); admin = server.getPgClient('postgres', '127.0.0.1'); await admin.connect();
  console.log((await admin.query('select version()')).rows[0].version);
  await admin.query(`do $$ begin if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if; end $$`);
  const source = await makeDb('src'); const doc = await snapshotOf(source);

  await check('the snapshot of the source is complete (schemas, functions with long identities, tables, view, sequence) and verifies against itself', async () => {
    assert.deepEqual(doc.counts, { sch: 2, fn: 2, rel: 3, seq: 1 });
    assert.ok(doc.rows.some(r => r.k === 'fn' && r.o === 'private.internal_step(a text, b jsonb)'));
    const r = await verify(source, doc); assert.equal(r.ok, true, r.message);
  });

  await check('a target that is MORE permissive by default is detected, reconciled and then verifies identically', async () => {
    const wide = await makeDb('wide', { widen: true });
    const before = await verify(wide, doc); assert.equal(before.ok, false); assert.match(before.message, /privilegios distintos de la instantánea en \d+ objetos/);
    assert.equal(await privilege(wide, `select has_function_privilege('anon','public.job_detail(int)','execute') v`), true);
    const fixed = await reconcile(wide, doc); assert.equal(fixed.ok, true, fixed.message);
    assert.equal(await privilege(wide, `select has_function_privilege('anon','public.job_detail(int)','execute') v`), false);
    assert.equal(await privilege(wide, `select has_table_privilege('anon','public.jobs','select') v`), false);
    const after = await verify(wide, doc); assert.equal(after.ok, true, after.message);
  });

  await check('an EXTRA function executable by anon is rejected (both modes) and nothing is changed by the failed reconcile', async () => {
    const t = await makeDb('extra_fn', { extra: `create function public.leak() returns int language sql security definer as $$ select 1 $$; grant execute on function public.leak() to anon;` });
    const v = await verify(t, doc); assert.equal(v.ok, false); assert.match(v.message, /INESPERADOS/); assert.match(v.message, /fn public\.leak\(\)/);
    await t.query(`grant select on public.jobs to anon`);                                   // a widening the reconcile WOULD fix, but the extra object aborts the whole transaction
    const r = await reconcile(t, doc); assert.equal(r.ok, false); assert.match(r.message, /INESPERADOS/);
    assert.equal(await privilege(t, `select has_table_privilege('anon','public.jobs','select') v`), true);   // rolled back: still wide until the operator investigates
    assert.equal(await privilege(t, `select has_function_privilege('anon','public.leak()','execute') v`), true);
  });

  await check('an EXTRA table or sequence in private/public is rejected; an explicit exception lets a managed object through (and is never auto-fixed)', async () => {
    const t = await makeDb('extra_tbl', { extra: `create table private.shadow(id int); create sequence public.extra_seq;` });
    const v = await verify(t, doc); assert.equal(v.ok, false); assert.match(v.message, /rel private\.shadow/); assert.match(v.message, /seq public\.extra_seq/);
    const ok = await verify(t, doc, { allowExtra: ['rel private.shadow', 'seq public.extra_seq'] }); assert.equal(ok.ok, true, ok.message);
    const partial = await verify(t, doc, { allowExtra: ['rel private.shadow'] }); assert.equal(partial.ok, false); assert.match(partial.message, /seq public\.extra_seq/);
  });

  await check('a difference ONLY in WITH GRANT OPTION is detected and restored in both directions', async () => {
    const lacks = await makeDb('grant_opt_a', { extra: '' });                               // source with the option, target without it
    const withOption = await makeDb('src_opt', { extra: `grant select on public.jobs to authenticated with grant option;` });
    const docOpt = await snapshotOf(withOption);
    assert.ok(docOpt.rows.find(r => r.o === 'public.jobs').acl.includes('authenticated:SELECT:GRANT'));
    assert.ok(!doc.rows.find(r => r.o === 'public.jobs').acl.includes(':GRANT'));
    const missingOpt = await verify(lacks, docOpt); assert.equal(missingOpt.ok, false); assert.match(missingOpt.message, /rel public\.jobs/);
    assert.equal((await reconcile(lacks, docOpt)).ok, true);
    assert.equal(await privilege(lacks, `select (select is_grantable from information_schema.table_privileges where table_schema='public' and table_name='jobs' and grantee='authenticated' and privilege_type='SELECT') = 'YES' v`), true);
    assert.equal((await verify(lacks, docOpt)).ok, true);
    const tooMuch = await makeDb('grant_opt_b', { extra: `grant select on public.jobs to authenticated with grant option;` });   // target can delegate, source cannot
    const delegable = await verify(tooMuch, doc); assert.equal(delegable.ok, false); assert.match(delegable.message, /rel public\.jobs/);
    assert.equal((await reconcile(tooMuch, doc)).ok, true);
    assert.equal(await privilege(tooMuch, `select (select count(*) from information_schema.table_privileges where table_schema='public' and table_name='jobs' and grantee='authenticated' and is_grantable='YES') = 0 v`), true);
  });

  await check('a snapshot object missing in the target fails', async () => {
    const t = await makeDb('missing_obj', { extra: `drop view public.jobs_view;` });
    const v = await verify(t, doc); assert.equal(v.ok, false); assert.match(v.message, /ausentes en el destino/); assert.match(v.message, /rel public\.jobs_view/);
  });

  await check('trimmed, altered or incomplete snapshots are rejected before any SQL exists', async () => {
    const trimmed = structuredClone(doc); trimmed.rows = trimmed.rows.slice(0, 1);
    assert.throws(() => buildReconcileSql(trimmed), /incompleta|alterada/);
    const oneRow = buildSnapshotDocSafe([{ k: 'fn', o: 'public.job_detail(x integer)', acl: 'authenticated:EXECUTE' }]); assert.equal(oneRow, null);   // a lone row has no schema rows: refused
    const cut = structuredClone(doc); cut.rows = cut.rows.filter(r => r.o !== 'public.job_detail(x integer)' && !r.o.startsWith('public.job_detail('));
    assert.throws(() => buildReconcileSql(cut), /conteos|digest/);                                                            // keeping the old counts/digest does not help
    const edited = structuredClone(doc); edited.rows.find(r => r.k === 'rel' && r.o === 'public.jobs').acl = 'authenticated:SELECT,anon:SELECT';
    assert.throws(() => buildReconcileSql(edited), /digest/);
    const v1 = structuredClone(doc); v1.version = 1; assert.throws(() => buildReconcileSql(v1), /versión 1 no soportada/);
  });

  await check('metadata cannot smuggle SQL: newlines in project or takenAt are rejected, in every mode', async () => {
    for (const field of ['project', 'takenAt', 'kind']) {
      const bad = structuredClone(doc); bad[field] = String(bad[field]) + '\nselect 123;';
      assert.throws(() => buildReconcileSql(bad), /inválida/, field); assert.throws(() => buildReconcileSql(bad, { verifyOnly: true }), /inválida/, field);
    }
    const ok = buildReconcileSql(doc, { verifyOnly: true });
    assert.equal(ok.split('\n')[0].startsWith('-- Generated by'), true); assert.ok(!/^select 123/m.test(ok));
    const objectNewline = structuredClone(doc); objectNewline.rows[0].o = 'public\nselect 1'; assert.throws(() => buildReconcileSql(objectNewline), /malformada/);
  });

  await check('an object NAME crafted as SQL never executes: DDL uses identifiers resolved from the target catalog', async () => {
    const t = await makeDb('inject', {});
    const rows = [...doc.rows, { k: 'rel', o: 'public.jobs; create table public.pwned(x int)', acl: 'anon:SELECT' }];
    const evil = buildSnapshotDoc(rows, { project: PROJECT, takenAt: '2026-11-13T12:00:00.000Z' });
    for (const verifyOnly of [true, false]) {
      const r = await run(t, buildReconcileSql(evil, { verifyOnly })); assert.equal(r.ok, false); assert.match(r.message, /ausentes en el destino/);
    }
    assert.equal(await privilege(t, `select to_regclass('public.pwned') is null v`), true);
    assert.equal((await reconcile(t, doc)).ok, true);                                                                          // the same target is reconcilable with the real snapshot
  });

  console.log(`\n${passed} comprobaciones PASS`);
} finally {
  for (const c of clients) await c.end().catch(() => {});
  await admin?.end().catch(() => {}); await server.stop().catch(() => {});
  await rm(root, { recursive: true, force: true }).catch(() => {});
}

function buildSnapshotDocSafe(rows) { try { return buildSnapshotDoc(rows, { project: PROJECT }); } catch { return null; } }
