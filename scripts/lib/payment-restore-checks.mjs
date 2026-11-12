// Sprint 05 restoration rehearsal for the financial model (PLAN 10). Runs INSIDE testSyntheticRestore, after the generic export/restore has loaded the
// source data into a second, new database built from the canonical migrations. Everything here is local/synthetic; no remote or Flow involvement.
import assert from 'node:assert/strict';

const PAYMENT_TABLES = ['payment_pricing_policies', 'job_extra_charges', 'payment_orders', 'payment_attempts', 'payment_events', 'payment_inbox', 'payment_rate_limits', 'payment_sandbox_accounts'];

// Projections compared column-by-column between the source and the restored database (amounts, references, states, digests, ciphertext fingerprints).
const PROJECTIONS = {
  policies: "select version,fee_basis_points,reason,created_by from private.payment_pricing_policies",
  extras: "select id,job_id,proposed_by,operation_id,concept,amount_clp,state from private.job_extra_charges",
  orders: "select id,job_id,extra_charge_id,origin,environment,customer_id,snapshot_sha256,professional_amount_clp,fee_basis_points,platform_fee_clp,total_clp,policy_version,consent_by,status,paid_attempt_id,flow_cost_clp,review_reason from private.payment_orders",
  attempts: "select id,order_id,idempotency_key,commerce_order,flow_order,state,error_code,md5(coalesce(encode(checkout_ciphertext,'hex'),'-')) ct,checkout_key_id from private.payment_attempts",
  events: "select id,order_id,attempt_id,provider_event_key,flow_order,commerce_order,observed_status,amount_clp,currency,flow_fee_clp,validation from private.payment_events",
  inbox: "select id,token_sha256,generation,processed_generation,state,md5(coalesce(encode(token_ciphertext,'hex'),'-')) ct,key_id from private.payment_inbox",
  sandboxAccounts: "select user_id,authorized_by,reason,revoked_at,revoked_by from private.payment_sandbox_accounts",
  jobs: "select id,payment_state from public.jobs",
};
const digest = async (db, sql) => (await db.query(`select count(*)::int n,md5(coalesce(string_agg(t::text,E'\\n' order by t::text),'')) d from (${sql}) t`)).rows[0];

// Grants/privileges that must survive a rebuild from migrations: no direct table access for any API role, exact RPC execute matrix.
const grantMatrix = async db => (await db.query(`
 select 'table' kind,c.relname::text name,c.relrowsecurity rls,
  array_to_string(array(select r||':'||p from unnest(array['anon','authenticated','service_role']) r,unnest(array['SELECT','INSERT','UPDATE','DELETE']) p where has_table_privilege(r,c.oid,p) order by 1),',') access
  from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relkind='r' and c.relname=any($1)
 union all
 select 'function',p.proname::text||'('||pg_get_function_identity_arguments(p.oid)||')',p.prosecdef,
  array_to_string(array(select r from unnest(array['anon','authenticated','service_role']) r where has_function_privilege(r,p.oid,'EXECUTE') order by 1),',')||'|'||coalesce(array_to_string(p.proconfig,','),'')
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'payment\\_%' or p.proname in('job_extra_propose','job_extra_respond','job_payments'))
 union all
 select 'trigger',t.tgname::text,t.tgenabled='O',t.tgrelid::regclass::text
  from pg_trigger t where not t.tgisinternal and (t.tgrelid::regclass::text like 'private.payment\\_%' or t.tgrelid::regclass::text like 'private.job\\_extra%' or t.tgname like '%payment%')
 order by 1,2`, [PAYMENT_TABLES])).rows;

export async function verifyRestoredPayments({ admin, restored, actors }) {
  // 1. Representative data really exists in the source (otherwise the rehearsal would prove nothing).
  const rep = (await admin.query(`select
   (select count(*)::int from private.payment_orders where origin='initial' and status='paid') paid_initial,
   (select count(*)::int from private.payment_orders where origin='extra') extra_orders,
   (select count(*)::int from private.payment_orders where review_reason is not null) reviews,
   (select count(*)::int from private.payment_orders where status='paid' and flow_cost_clp is not null) with_cost,
   (select count(*)::int from private.job_extra_charges where state='accepted') accepted_extras,
   (select count(*)::int from private.payment_attempts) attempts,
   (select count(distinct validation)::int from private.payment_events) event_kinds,
   (select count(*)::int from private.payment_pricing_policies) policy_versions,
   (select count(*)::int from private.payment_inbox) inbox,
   (select count(*)::int from private.payment_sandbox_accounts where revoked_at is null) sandbox_accounts`)).rows[0];
  assert.ok(rep.paid_initial >= 1 && rep.extra_orders >= 1 && rep.reviews >= 1 && rep.with_cost >= 1 && rep.accepted_extras >= 1 && rep.attempts >= 5 && rep.event_kinds >= 4 && rep.policy_versions >= 2 && rep.inbox >= 1 && rep.sandbox_accounts >= 1, 'the source lacks representative financial data: ' + JSON.stringify(rep));

  // 2. Amounts, references, states and ciphertext fingerprints are identical after restore.
  for (const [name, sql] of Object.entries(PROJECTIONS)) {
    const a = await digest(admin, sql), b = await digest(restored, sql);
    assert.deepEqual(b, a, 'restored financial projection differs: ' + name);
  }

  // 3. Financial invariants hold in the RESTORED database itself.
  const bad = async (label, sql) => assert.equal((await restored.query(sql)).rows[0].n, 0, label);
  await bad('total = Q + F', 'select count(*)::int n from private.payment_orders where total_clp<>professional_amount_clp+platform_fee_clp');
  await bad('fee recomputed from the frozen rate', 'select count(*)::int n from private.payment_orders where platform_fee_clp<>private.payment_fee_clp(professional_amount_clp,fee_basis_points)');
  await bad('frozen policy version exists with the same rate', 'select count(*)::int n from private.payment_orders o join private.payment_pricing_policies p on p.version=o.policy_version where p.fee_basis_points<>o.fee_basis_points');
  await bad('every paid order points to a paid attempt of its own', "select count(*)::int n from private.payment_orders o where o.status='paid' and not exists(select 1 from private.payment_attempts a where a.id=o.paid_attempt_id and a.order_id=o.id and a.state='paid')");
  await bad('every paid order has a verified event for exactly the frozen total', "select count(*)::int n from private.payment_orders o where o.status='paid' and not exists(select 1 from private.payment_events e where e.attempt_id=o.paid_attempt_id and e.validation in('applied','late_payment') and e.amount_clp=o.total_clp and e.currency='CLP')");
  await bad('one initial order per job', "select count(*)::int n from (select job_id from private.payment_orders where origin='initial' group by job_id having count(*)>1) x");
  await bad('commerce references stay unique and well formed', "select count(*)::int n from private.payment_attempts where commerce_order !~ '^fixo-sandbox-[0-9a-f-]{36}$'");
  await bad('a job with a verified initial payment never shows an unpaid state', "select count(*)::int n from public.jobs j where j.payment_state in('not_enabled','payment_pending','payment_failed') and exists(select 1 from private.payment_orders o where o.job_id=j.id and o.origin='initial' and o.status='paid')");

  // 4. RLS flags, grants, SECURITY DEFINER/search_path and triggers are rebuilt exactly (canonical migrations are the contract, not the dump).
  const gSource = await grantMatrix(admin), gRestored = await grantMatrix(restored);
  assert.deepEqual(gRestored, gSource, 'restored grants/RLS/triggers differ');
  assert.ok(gRestored.filter(r => r.kind === 'table').length === PAYMENT_TABLES.length && gRestored.filter(r => r.kind === 'table').every(r => r.rls === true && r.access === ''), 'payment tables: RLS on and no API-role grants');
  assert.ok(gRestored.filter(r => r.kind === 'function').length >= 24 && gRestored.filter(r => r.kind === 'trigger').some(r => r.name === 'payment_events_append_only') && gRestored.some(r => r.name === 'a_job_cancellation_payment_review'));

  // 5. Immutability still bites after restore (the data load ran with triggers disabled only inside its own transaction).
  await assert.rejects(() => restored.query("update private.payment_events set validation='applied'"), { code: 'PT409' });
  await assert.rejects(() => restored.query('update private.payment_pricing_policies set fee_basis_points=0'), { code: 'PT409' });
  await assert.rejects(() => restored.query('update private.payment_orders set total_clp=total_clp+1,professional_amount_clp=professional_amount_clp+1'), { code: 'PT409' });

  // 6. Role-aware reads and API-role isolation on the restored database.
  const job = (await restored.query("select o.job_id from private.payment_orders o where o.origin='initial' and o.status='paid' order by o.created_at limit 1")).rows[0].job_id;
  const expected = (await restored.query("select total_clp,professional_amount_clp q from private.payment_orders where job_id=$1 and origin='initial'", [job])).rows[0];
  const as = async (actor, sql, args) => {
    const claims = (await actors[actor].client.query("select current_setting('request.jwt.claims') claims")).rows[0].claims;
    await restored.query('set role authenticated'); await restored.query("select set_config('request.jwt.claims',$1,false)", [claims]);
    try { return (await restored.query(sql, args)).rows[0]?.value; } finally { await restored.query('reset role'); }
  };
  const customerView = await as('customerA', 'select public.job_payments($1) value', [job]);
  assert.equal(Number(customerView.orders[0].total_clp), Number(expected.total_clp));
  const technicianView = await as('technicianA', 'select public.job_payments($1) value', [job]);
  assert.equal(technicianView.orders[0].total_clp, null); assert.equal(Number(technicianView.orders[0].professional_amount_clp), Number(expected.q));
  const stranger = await as('customerB', 'select public.job_payments($1) value', [job]).then(v => v, e => ({ denied: e.code }));
  assert.ok(stranger?.denied === '42501' || !stranger?.orders?.length, 'a stranger must not read the restored financial history');
  await restored.query('set role authenticated');
  await assert.rejects(() => restored.query('select * from private.payment_orders'), { code: '42501' });
  await assert.rejects(() => restored.query("insert into private.payment_events(provider_event_key,observed_status,validation)values('forged-after-restore',2,'applied')"), { code: '42501' });
  await assert.rejects(() => restored.query("select public.payment_purge_sensitive(0)"), { code: '42501' });
  await restored.query('reset role');
  const policy = (await restored.query('select max(version)::int v from private.payment_pricing_policies')).rows[0].v;
  assert.equal(policy, (await admin.query('select max(version)::int v from private.payment_pricing_policies')).rows[0].v);
  return { representative: rep, projectionsCompared: Object.keys(PROJECTIONS), grantsAndTriggersCompared: gRestored.length, invariantsChecked: 8 };
}
