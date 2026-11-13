// LOCAL-ONLY proof of the criterion-retirement SQL used by the remote Flow Sandbox run (scripts/flow-sandbox/logic.mjs): success, rollback on a digest
// mismatch, refusal when something foreign references the criterion, and a CONCURRENT submission (an application picking the criterion up between the check
// and the delete is blocked by the locks and then detected). Runs against the isolated local Supabase DB only; run `supabase db reset` afterwards.
//   FIXO_PAYMENTS_LOCAL_SUPABASE=isolated-local FIXO_TEST_DB_URL=<loopback>
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { buildRetireCriterionSql } from './flow-sandbox/logic.mjs';

assert.equal(process.env.FIXO_PAYMENTS_LOCAL_SUPABASE, 'isolated-local');
const dbUrl = process.env.FIXO_TEST_DB_URL; assert.ok(dbUrl && ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(dbUrl).hostname), 'FIXO_TEST_DB_URL must be loopback');
const connect = async () => { const c = new pg.Client({ connectionString: dbUrl }); await c.connect(); return c; };
const db = await connect(), tx = await connect(), retirer = await connect();
const q = async (c, sql, args) => (await c.query(sql, args)).rows;
const digest = async () => (await q(db, "select count(*)::int n, md5(coalesce(string_agg(t::text,E'\\n' order by t::text),'')) d from private.category_requirements t"))[0];
const waitBlocked = async () => { for (let i = 0; i < 100; i++) { if ((await q(db, "select count(*)::int n from pg_stat_activity where wait_event_type='Lock' and query like '%retire%' and pid<>pg_backend_pid()"))[0].n) return; await new Promise(r => setTimeout(r, 100)); } throw new Error('retirement never blocked on the locks'); };
const checks = []; const check = async (name, fn) => { await fn(); checks.push(name); console.log('PASS  ' + name); };

assert.equal((await digest()).n, 0, 'local requirements table must be empty (run supabase db reset)');
const before = await digest(), run = 'localtest' + randomUUID().slice(0, 6);
const mkTech = async label => { const id = randomUUID(); await q(db, "insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)", [id, `${run}-${label}@sandbox.fixo.invalid`, { first_name: 'Sintético', last_name: label, phone: '+56912345678', terms_accepted: true, account_type: 'technician', category_ids: ['gasfiteria'], coverage_areas: ['Ñuñoa'] }]); return id; };
const admin = randomUUID(); await q(db, "insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)", [admin, `${run}-admin@sandbox.fixo.invalid`, { first_name: 'S', last_name: 'A', phone: '+56912345678', terms_accepted: true }]);
const tech = await mkTech('tech'), outsider = await mkTech('outsider');
const addCriterion = async () => { const [r] = await q(db, "insert into private.category_requirements(category_id,requirement_key,version,kind,required,document_type,description,created_by) values('gasfiteria',$1,1,'internal',false,'other','Criterio sintético de prueba local',$2) returning id", [run + randomUUID().slice(0, 4), admin]); return r; };
const point = (id, crit) => q(db, "update private.technician_applications set requirement_snapshot=array[$2::uuid] where technician_id=$1", [id, crit]);
const input = (crit, key, b = before) => ({ criterion: crit, run: key, technician: tech, before: b });
const exists = async crit => (await q(db, 'select count(*)::int n from private.category_requirements where id=$1', [crit]))[0].n;

try {
  await check('success: the criterion is removed and the shared configuration digest equals the previous one', async () => {
    const c = await addCriterion(); await point(tech, c.id); assert.equal((await digest()).n, 1);
    const key = (await q(db, 'select requirement_key k from private.category_requirements where id=$1', [c.id]))[0].k;
    await q(retirer, buildRetireCriterionSql(input(c.id, key))); assert.equal(await exists(c.id), 0); assert.deepEqual(await digest(), before);
  });
  await check('a digest mismatch RAISES and the delete is rolled back (the criterion survives)', async () => {
    const c = await addCriterion(); const key = (await q(db, 'select requirement_key k from private.category_requirements where id=$1', [c.id]))[0].k;
    await assert.rejects(() => q(retirer, buildRetireCriterionSql(input(c.id, key, { n: 5, d: 'deadbeef' }))), /no coincide con la previa/);
    assert.equal(await exists(c.id), 1); await q(db, 'delete from private.category_requirements where id=$1', [c.id]);
  });
  await check('refuses (and deletes nothing) when something foreign already references the criterion', async () => {
    const c = await addCriterion(); const key = (await q(db, 'select requirement_key k from private.category_requirements where id=$1', [c.id]))[0].k; await point(outsider, c.id);
    await assert.rejects(() => q(retirer, buildRetireCriterionSql(input(c.id, key))), /referencia algo ajeno/); assert.equal(await exists(c.id), 1);
    await point(outsider, randomUUID()); await q(db, 'delete from private.category_requirements where id=$1', [c.id]);
  });
  await check('CONCURRENT submission: an application that references the criterion while the retirement waits is detected after the lock; nothing is deleted', async () => {
    const c = await addCriterion(); const key = (await q(db, 'select requirement_key k from private.category_requirements where id=$1', [c.id]))[0].k; await point(tech, c.id);
    await tx.query('begin'); await tx.query("update private.technician_applications set requirement_snapshot=array[$2::uuid] where technician_id=$1", [outsider, c.id]);   // uncommitted submission
    const retiring = q(retirer, buildRetireCriterionSql(input(c.id, key))).then(() => ({ ok: true }), e => ({ error: String(e.message) }));
    await waitBlocked(); assert.equal(await exists(c.id), 1);                                                                                  // blocked behind the open submission
    await tx.query('commit'); const outcome = await retiring;
    assert.match(outcome.error ?? '', /referencia algo ajeno/); assert.equal(await exists(c.id), 1);
    assert.deepEqual((await q(db, 'select requirement_snapshot rs from private.technician_applications where technician_id=$1', [outsider]))[0].rs, [c.id]);   // the submission kept a VALID reference
    await point(outsider, randomUUID()); await q(db, 'delete from private.category_requirements where id=$1', [c.id]); assert.deepEqual(await digest(), before);
  });
  console.log(JSON.stringify({ status: 'PASS local', checks: checks.length, remote: false }));
} finally { await tx.query('rollback').catch(() => {}); for (const c of [db, tx, retirer]) await c.end().catch(() => {}); }
