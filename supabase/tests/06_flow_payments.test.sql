-- Sprint 05 (Flow Sandbox payments) regression. SQL fixture identities only; no Flow, no network, every write rolls back.
-- Complements scripts/test-payments-postgres.mjs (concurrency, multi-connection leases, restore) with the invariants that are cheap
-- and stable in pgTAP: structure/privileges, RLS/ACL boundaries, frozen financial terms, verified-only payment, role-aware reads.
begin;
set local search_path=public,extensions;
create extension if not exists pgtap with schema extensions;
select plan(107);

-- ------------------------------------------------------------------ 1. structure and privileges
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relkind='r'
 and c.relname=any(array['payment_pricing_policies','job_extra_charges','payment_orders','payment_attempts','payment_events','payment_inbox','payment_rate_limits'])),7,'financial tables exist in the private schema');
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relrowsecurity
 and c.relname=any(array['payment_pricing_policies','job_extra_charges','payment_orders','payment_attempts','payment_events','payment_inbox','payment_rate_limits'])),7,'RLS is enabled on every financial table');
select is((select count(*)::int from unnest(array['payment_pricing_policies','job_extra_charges','payment_orders','payment_attempts','payment_events','payment_inbox','payment_rate_limits']) t
 cross join unnest(array['anon','authenticated','service_role']) r cross join unnest(array['SELECT','INSERT','UPDATE','DELETE']) p
 where has_table_privilege(r,'private.'||t,p)),0,'no role has direct DML or SELECT on any financial table');
select is((select count(*)::int from unnest(array['payment_policy_current()','payment_policy_set(integer,integer,text)','payment_prepare(uuid,uuid,integer,boolean,uuid)','job_extra_propose(uuid,uuid,text,bigint)',
 'job_extra_respond(uuid,text,integer,text)','job_payments(uuid)','payment_request_reconciliation(uuid)','payment_admin_overview()','payment_enable_sandbox_job(uuid,integer,text)']) f
 where has_function_privilege('authenticated','public.'||f,'EXECUTE')),9,'authenticated can run the 9 user-facing payment RPCs');
select is((select count(*)::int from unnest(array['payment_policy_current()','payment_policy_set(integer,integer,text)','payment_prepare(uuid,uuid,integer,boolean,uuid)','job_extra_propose(uuid,uuid,text,bigint)',
 'job_extra_respond(uuid,text,integer,text)','job_payments(uuid)','payment_request_reconciliation(uuid)','payment_admin_overview()','payment_enable_sandbox_job(uuid,integer,text)']) f
 cross join unnest(array['anon','service_role']) r where has_function_privilege(r,'public.'||f,'EXECUTE')),0,'anon and the worker cannot run user-facing payment RPCs');
select is((select count(*)::int from unnest(array['payment_attempt_begin_create(uuid)','payment_attempt_set_checkout(uuid,bigint,bytea,text)','payment_attempt_mark_ambiguous(uuid,text)','payment_attempt_mark_failed(uuid,text)',
 'payment_attempt_checkout(uuid,uuid)','payment_inbox_receive(text,bytea,text)','payment_inbox_claim()','payment_inbox_finish(uuid,uuid,text,integer,text)','payment_attempt_claim_due()',
 'payment_attempt_release(uuid,uuid,integer,text)','payment_attempt_lookup(text,bigint)','payment_apply_observation(uuid,text,bigint,text,integer,bigint,text,bigint,timestamptz)',
 'payment_rate_limit_hit(text,text,integer,integer)','payment_rate_limit_cleanup()','payment_purge_sensitive(integer)']) f
 cross join unnest(array['anon','authenticated']) r where has_function_privilege(r,'public.'||f,'EXECUTE')),0,'browser roles cannot run any worker-only RPC (no way to insert a verified payment)');
select is((select count(*)::int from unnest(array['payment_attempt_begin_create(uuid)','payment_attempt_set_checkout(uuid,bigint,bytea,text)','payment_attempt_mark_ambiguous(uuid,text)','payment_attempt_mark_failed(uuid,text)',
 'payment_attempt_checkout(uuid,uuid)','payment_inbox_receive(text,bytea,text)','payment_inbox_claim()','payment_inbox_finish(uuid,uuid,text,integer,text)','payment_attempt_claim_due()',
 'payment_attempt_release(uuid,uuid,integer,text)','payment_attempt_lookup(text,bigint)','payment_apply_observation(uuid,text,bigint,text,integer,bigint,text,bigint,timestamptz)',
 'payment_rate_limit_hit(text,text,integer,integer)','payment_rate_limit_cleanup()','payment_purge_sensitive(integer)']) f where has_function_privilege('service_role','public.'||f,'EXECUTE')),15,'the worker can run the 15 worker RPCs');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prosecdef and n.nspname in('public','private')
 and (p.proname like 'payment\_%' or p.proname like 'job\_extra\_%' or p.proname='job_payments')
 and not exists(select 1 from unnest(coalesce(p.proconfig,'{}'::text[])) c where c like 'search_path=%')),0,'every payment SECURITY DEFINER function pins its search_path');
select is((select fee_basis_points from private.payment_pricing_policies where version=1),500,'initial policy is 5 % (500 basis points)');
select throws_ok($$update private.payment_pricing_policies set fee_basis_points=0 where version=1$$,'PT409',null,'policy history is immutable even for the owner (update)');
select throws_ok($$delete from private.payment_pricing_policies where version=1$$,'PT409',null,'policy history is immutable even for the owner (delete)');

-- ------------------------------------------------------------------ 2. fixtures (rolled back)
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)values
 ('95000000-0000-4000-8000-000000000001','s05-customer@local.invalid',now(),'{"first_name":"Synthetic","last_name":"Customer","phone":"+56912345678","terms_accepted":true}'),
 ('95000000-0000-4000-8000-000000000002','s05-tech@local.invalid',now(),'{"first_name":"Synthetic","last_name":"Technician","phone":"+56912345678","terms_accepted":true,"account_type":"technician"}'),
 ('95000000-0000-4000-8000-000000000003','s05-other@local.invalid',now(),'{"first_name":"Synthetic","last_name":"Other","phone":"+56912345678","terms_accepted":true}'),
 ('95000000-0000-4000-8000-000000000004','s05-moderator@local.invalid',now(),'{"first_name":"Synthetic","last_name":"Moderator","phone":"+56912345678","terms_accepted":true}'),
 ('95000000-0000-4000-8000-000000000005','s05-superadmin@local.invalid',now(),'{"first_name":"Synthetic","last_name":"Superadmin","phone":"+56912345678","terms_accepted":true}');
update public.profiles set role='moderator' where id='95000000-0000-4000-8000-000000000004';
update public.profiles set role='superadmin' where id='95000000-0000-4000-8000-000000000005';
insert into auth.sessions(id,user_id,created_at,updated_at)select id,id,now(),now() from auth.users where id::text like '95000000-0000-4000-8000-00000000000%';
create function pg_temp.as_user(n integer) returns text language sql as $$
 select set_config('request.jwt.claims',format('{"sub":"95000000-0000-4000-8000-00000000000%s","session_id":"95000000-0000-4000-8000-00000000000%s","role":"authenticated"}',n,n),true)
$$;
select pg_temp.as_user(1);
create temporary table s05_requests(n integer, id uuid);
insert into s05_requests select 1,(public.marketplace_create_request('95000000-0000-4000-8000-000000000010','{"categoryId":"jardineria","title":"Trabajo sintético pgTAP S05 uno","description":"Solicitud sintética para verificar pagos Flow Sandbox","locationLabel":"Ñuñoa","address":"Dirección sintética privada"}')->>'id')::uuid;
update public.service_requests set created_at=now()-interval '3 days' where customer_id='95000000-0000-4000-8000-000000000001';
insert into s05_requests select 2,(public.marketplace_create_request('95000000-0000-4000-8000-000000000020','{"categoryId":"jardineria","title":"Trabajo sintético pgTAP S05 dos","description":"Segunda solicitud sintética para verificar pagos Flow Sandbox","locationLabel":"Ñuñoa","address":"Dirección sintética privada"}')->>'id')::uuid;
insert into public.quotes(id,service_request_id,technician_id,labor_clp,description,estimated_duration,available_date,expires_at,status)
 select (case n when 1 then '95000000-0000-4000-8000-000000000011' else '95000000-0000-4000-8000-000000000021' end)::uuid,id,'95000000-0000-4000-8000-000000000002',25000,'Trabajo sintético para regresión SQL','2 horas',now()+interval '2 days',now()+interval '3 days','accepted' from s05_requests;
insert into public.jobs(id,service_request_id,quote_id,customer_id,technician_id,snapshot)
 select (case n when 1 then '95000000-0000-4000-8000-000000000012' else '95000000-0000-4000-8000-000000000022' end)::uuid,id,
  (case n when 1 then '95000000-0000-4000-8000-000000000011' else '95000000-0000-4000-8000-000000000021' end)::uuid,
  '95000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000002','{"priceClp":25000,"currency":"CLP"}'::jsonb from s05_requests;
select is((select count(*)::int from public.jobs where id in('95000000-0000-4000-8000-000000000012','95000000-0000-4000-8000-000000000022')),2,'fixture: two jobs with frozen snapshots exist');
select is((select payment_state from public.jobs where id='95000000-0000-4000-8000-000000000012'),'not_enabled','no order yet: payment_state is not_enabled');

-- ------------------------------------------------------------------ 3. customer: consent, authorization, idempotent preparation
set local role authenticated;
select throws_ok($$select public.payment_prepare('95000000-0000-4000-8000-000000000012',null,1,false,'95000000-0000-4000-8000-0000000000a1')$$,'22023',null,'no order without explicit financial consent');
select throws_ok($$select public.payment_prepare('95000000-0000-4000-8000-000000000012',null,null,true,'95000000-0000-4000-8000-0000000000a1')$$,'22023',null,'a null policy version never skips the consent');
select throws_ok($$select public.payment_prepare('95000000-0000-4000-8000-000000000012',null,2,true,'95000000-0000-4000-8000-0000000000a1')$$,'PT409',null,'a policy version the customer did not see is refused');
select pg_temp.as_user(3);
select throws_ok($$select public.payment_prepare('95000000-0000-4000-8000-000000000012',null,1,true,'95000000-0000-4000-8000-0000000000a1')$$,'42501',null,'another customer cannot pay the job');
select pg_temp.as_user(2);
select throws_ok($$select public.payment_prepare('95000000-0000-4000-8000-000000000012',null,1,true,'95000000-0000-4000-8000-0000000000a1')$$,'42501',null,'the technician cannot pay (nor consent for the customer)');
select pg_temp.as_user(1);
select is((public.payment_prepare('95000000-0000-4000-8000-000000000012',null,1,true,'95000000-0000-4000-8000-0000000000a1'))->>'total_clp','26250','Q 25.000 + F 5 % = T 26.250 shown at preparation');
select is((public.payment_prepare('95000000-0000-4000-8000-000000000012',null,1,true,'95000000-0000-4000-8000-0000000000a1'))->>'attempt_state','prepared','replay with the same key returns the same prepared attempt');
select is((select count(*)::int from jsonb_array_elements(public.job_payments('95000000-0000-4000-8000-000000000012')->'orders')),1,'replay and double click never create a second order');
select throws_ok($$update private.payment_orders set total_clp=1$$,'42501',null,'the browser has no direct DML on orders');
select throws_ok($$update private.payment_pricing_policies set fee_basis_points=0$$,'42501',null,'the browser cannot edit the fee policy');
select throws_ok($$select * from private.payment_events$$,'42501',null,'the browser cannot read financial events');
select throws_ok($$update public.jobs set payment_state='paid',revision=revision+1 where id='95000000-0000-4000-8000-000000000012'$$,'42501',null,'the browser cannot forge payment_state');
select throws_ok($$select public.payment_attempt_begin_create('95000000-0000-4000-8000-0000000000a1')$$,'42501',null,'the browser cannot call worker RPCs');
reset role;

-- frozen terms and projection (as owner)
select is((select (professional_amount_clp,platform_fee_clp,total_clp,fee_basis_points,policy_version)::text from private.payment_orders where job_id='95000000-0000-4000-8000-000000000012'),'(25000,1250,26250,500,1)','order freezes Q/F/T, rate and policy version');
select is((select consent_by from private.payment_orders where job_id='95000000-0000-4000-8000-000000000012'),'95000000-0000-4000-8000-000000000001'::uuid,'consent is recorded for the customer');
select is((select payment_state from public.jobs where id='95000000-0000-4000-8000-000000000012'),'payment_pending','payment_state is a projection of the order (pending)');
select throws_ok($$update public.jobs set payment_state='paid',revision=revision+1 where id='95000000-0000-4000-8000-000000000012'$$,'PT409',null,'even the owner cannot set a state that differs from the projection');
select throws_ok($$update private.payment_orders set total_clp=1 where job_id='95000000-0000-4000-8000-000000000012'$$,'PT409',null,'order terms are immutable');
select throws_ok($$insert into private.payment_orders(job_id,origin,customer_id,snapshot_sha256,professional_amount_clp,fee_basis_points,platform_fee_clp,total_clp,policy_version,consent_by)
 values('95000000-0000-4000-8000-000000000022','initial','95000000-0000-4000-8000-000000000001',repeat('a',64),25000,500,1250,99999,1,'95000000-0000-4000-8000-000000000001')$$,'23514',null,'T must equal Q + F');
select set_config('s05.attempt1',(select a.id::text from private.payment_attempts a join private.payment_orders o on o.id=a.order_id where o.job_id='95000000-0000-4000-8000-000000000012'),true);
select set_config('s05.commerce1',(select commerce_order from private.payment_attempts where id=current_setting('s05.attempt1')::uuid),true);
select ok(current_setting('s05.commerce1') like 'fixo-sandbox-%','each attempt has its own commerce reference, distinct from the order id');

-- ------------------------------------------------------------------ 4. verified payment only (worker)
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select is((public.payment_attempt_begin_create(current_setting('s05.attempt1')::uuid))->>'amount_clp','26250','the worker reserves the attempt for T before any network call');
select lives_ok($$select public.payment_attempt_set_checkout(current_setting('s05.attempt1')::uuid,5001,'\x0102'::bytea,'test-key')$$,'checkout is stored encrypted-by-the-app (opaque bytes)');
select is((public.payment_apply_observation(current_setting('s05.attempt1')::uuid,'s05-pending',5001,current_setting('s05.commerce1'),1,26250,'CLP',null,null))->>'result','pending','Flow status 1 is only pending');
select is((public.payment_apply_observation(current_setting('s05.attempt1')::uuid,'s05-paid',5001,current_setting('s05.commerce1'),2,26250,'CLP',300,null))->>'result','applied','a correlated, exact verified observation applies the payment');
select is((public.payment_apply_observation(current_setting('s05.attempt1')::uuid,'s05-paid',5001,current_setting('s05.commerce1'),2,26250,'CLP',300,null))->>'result','duplicate','replaying the same observation is deduplicated');
select is((public.payment_apply_observation(current_setting('s05.attempt1')::uuid,'s05-late-reject',5001,current_setting('s05.commerce1'),3,26250,'CLP',300,null))->>'result','stale','a later rejection never reverts a paid order');
select is((public.payment_rate_limit_hit('checkout_user','user:s05',2,86400))->>'allowed','true','rate limiter allows within the limit');
select is((public.payment_rate_limit_hit('checkout_user','user:s05',2,86400))->>'allowed','true','second hit is still allowed');
select is((public.payment_rate_limit_hit('checkout_user','user:s05',2,86400))->>'allowed','false','third hit within the window is denied (fail-closed counting)');
select lives_ok($$select public.payment_inbox_receive(repeat('b',64),'\x0a'::bytea,'test-key')$$,'the callback is persisted durably before acknowledging');
select lives_ok($$select public.payment_inbox_receive(repeat('b',64),'\x0a'::bytea,'test-key')$$,'a duplicate notification is accepted');
reset role;
select is((select count(*)::int from private.payment_inbox where token_sha256=repeat('b',64)),1,'duplicate notifications converge to one inbox row');
select is((select generation from private.payment_inbox where token_sha256=repeat('b',64)),2,'a later notification of the same token bumps the generation instead of being lost');

select is((select status from private.payment_orders where job_id='95000000-0000-4000-8000-000000000012'),'paid','order is paid only after the verified observation');
select is((select payment_state from public.jobs where id='95000000-0000-4000-8000-000000000012'),'paid','job projection follows the verified payment');
select is((select flow_cost_clp from private.payment_orders where job_id='95000000-0000-4000-8000-000000000012'),300::bigint,'Flow cost G is recorded separately; Q is untouched');
select is((select professional_amount_clp from private.payment_orders where job_id='95000000-0000-4000-8000-000000000012'),25000::bigint,'the professional amount Q never decreases by the Flow cost');
select is((select count(*)::int from private.payment_events where provider_event_key='s05-paid'),1,'one append-only event per verified observation');
select throws_ok($$update private.payment_events set provider_event_key='x' where provider_event_key='s05-paid'$$,'PT409',null,'financial events are append-only (update)');
select throws_ok($$delete from private.payment_events where provider_event_key='s05-paid'$$,'PT409',null,'financial events are append-only (delete)');
select is((select count(*)::int from private.notification_outbox o join private.job_events e on e.id=o.event_id where e.job_id='95000000-0000-4000-8000-000000000012' and e.action='payment_confirmed'),2,'one notice per participant, no duplicates');
select is((select (source,actor_id is null)::text from private.job_events where job_id='95000000-0000-4000-8000-000000000012' and action='payment_confirmed'),'(provider,t)','provider events do not impersonate a person');

-- ------------------------------------------------------------------ 5. mismatches never pay
select pg_temp.as_user(1);
set local role authenticated;
select lives_ok($$select public.payment_prepare('95000000-0000-4000-8000-000000000022',null,1,true,'95000000-0000-4000-8000-0000000000b1')$$,'job 2: order and attempt prepared');
reset role;
select set_config('s05.attempt2',(select a.id::text from private.payment_attempts a join private.payment_orders o on o.id=a.order_id where o.job_id='95000000-0000-4000-8000-000000000022'),true);
select set_config('s05.commerce2',(select commerce_order from private.payment_attempts where id=current_setting('s05.attempt2')::uuid),true);
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select lives_ok($$select public.payment_attempt_begin_create(current_setting('s05.attempt2')::uuid)$$,'job 2: attempt reserved');
select lives_ok($$select public.payment_attempt_set_checkout(current_setting('s05.attempt2')::uuid,5002,'\x0102'::bytea,'test-key')$$,'job 2: checkout stored');
select is((public.payment_apply_observation(current_setting('s05.attempt2')::uuid,'s05-wrong-amount',5002,current_setting('s05.commerce2'),2,25000,'CLP',null,null))->>'validation','mismatch','paying Q instead of T is a mismatch');
select is((public.payment_apply_observation(null,'s05-unknown',999999,'fixo-sandbox-unknown',2,26250,'CLP',null,null))->>'validation','unknown_identity','unknown provider identity is quarantined');
reset role;
select is((select (status,review_reason)::text from private.payment_orders where job_id='95000000-0000-4000-8000-000000000022'),'(awaiting_payment,provider_mismatch)','a mismatch never marks paid and sends the order to review');
select is((select payment_state from public.jobs where id='95000000-0000-4000-8000-000000000022'),'payment_review','the job shows review, not paid');
select is((select count(*)::int from private.payment_orders where status='paid' and job_id='95000000-0000-4000-8000-000000000022'),0,'no payment recorded for job 2');

-- ------------------------------------------------------------------ 6. role-aware reads
select pg_temp.as_user(2);
set local role authenticated;
select is((public.job_payments('95000000-0000-4000-8000-000000000012')->'orders'->0->>'total_clp'),null::text,'the technician never sees the customer total');
select is((public.job_payments('95000000-0000-4000-8000-000000000012')->'orders'->0->>'platform_fee_clp'),null::text,'the technician never sees the platform fee');
select is((public.job_payments('95000000-0000-4000-8000-000000000012')->'orders'->0->>'professional_amount_clp'),'25000','the technician sees the assigned amount Q');
select is((public.job_payments('95000000-0000-4000-8000-000000000012')->'orders'->0->>'latest_attempt_id'),null::text,'the technician does not get checkout identifiers');
select is((public.job_payments('95000000-0000-4000-8000-000000000012')->'orders'->0->>'flow_cost_clp'),null::text,'the technician does not see the Flow cost');
select pg_temp.as_user(3);
select ok(public.job_payments('95000000-0000-4000-8000-000000000012') is null,'a third party gets nothing');
select pg_temp.as_user(1);
select is((public.job_payments('95000000-0000-4000-8000-000000000012')->'orders'->0->>'total_clp'),'26250','the customer sees Q, F and T');
select is((public.job_payments('95000000-0000-4000-8000-000000000012')->'orders'->0->>'policy_version'),'1','the frozen policy version is exposed for consent checks');
select is((public.job_payments('95000000-0000-4000-8000-000000000012')->'orders'->0->>'flow_cost_clp'),null::text,'the customer does not see the Flow cost');
select is((public.job_payments('95000000-0000-4000-8000-000000000012')->'orders'->0->>'simulated_settlement_clp'),null::text,'no simulated settlement before a confirmed closure');
reset role;

-- ------------------------------------------------------------------ 7. policy administration
select pg_temp.as_user(4);
set local role authenticated;
select throws_ok($$select public.payment_policy_set(1,700,'Moderador sin permiso para editar')$$,'42501',null,'a moderator cannot change the fee');
select lives_ok($$select public.payment_admin_overview()$$,'a moderator can read the payment overview');
select throws_ok($$select public.payment_request_reconciliation('95000000-0000-4000-8000-0000000000c1')$$,'42501',null,'a moderator cannot schedule a re-check');
select throws_ok($$select public.payment_enable_sandbox_job('95000000-0000-4000-8000-000000000012',24,'Moderador sin permiso para habilitar')$$,'42501',null,'a moderator cannot enable Sandbox execution');
select pg_temp.as_user(1);
select throws_ok($$select public.payment_admin_overview()$$,'42501',null,'a customer cannot read the overview');
select pg_temp.as_user(5);
select throws_ok($$select public.payment_policy_set(1,2001,'Porcentaje fuera de rango permitido')$$,'22023',null,'rate above 20 % is rejected');
select throws_ok($$select public.payment_policy_set(1,700,'corto')$$,'22023',null,'a reason is mandatory');
select throws_ok($$select public.payment_policy_set(7,700,'Versión obsoleta de otra pestaña')$$,'PT409',null,'a stale expected version conflicts');
select is((public.payment_policy_set(1,700,'Ajuste comercial de prueba aprobado'))->>'version','2','a superadmin creates version 2');
select is((public.payment_admin_overview()->'history'->0->>'reason'),'Ajuste comercial de prueba aprobado','history keeps the reason');
select ok((public.payment_admin_overview()->'history'->0->>'author_name') is not null,'history keeps the author');
select throws_ok($$select public.payment_request_reconciliation('95000000-0000-4000-8000-0000000000c1')$$,'PT409',null,'a re-check only applies to a pending attempt; it cannot impose a state');
reset role;
select is((select fee_basis_points from private.payment_orders where job_id='95000000-0000-4000-8000-000000000012'),500,'existing orders keep their frozen rate after a policy change');
select is((select payment_state from public.jobs where id='95000000-0000-4000-8000-000000000012'),'paid','a policy change never alters a paid order');

-- stale consent: job 2 order is frozen under version 1; the policy is now version 2
select pg_temp.as_user(1);
set local role authenticated;
select throws_ok($$select public.payment_prepare('95000000-0000-4000-8000-000000000022',null,2,true,'95000000-0000-4000-8000-0000000000b9')$$,'PT409','El desglose cambió; actualiza la página y confirma nuevamente','a consent for another breakdown cannot reuse an order frozen under version 1');
select throws_ok($$select public.payment_prepare('95000000-0000-4000-8000-000000000012',null,1,true,'95000000-0000-4000-8000-0000000000b8')$$,'PT409',null,'a paid obligation cannot be prepared again');
reset role;

-- ------------------------------------------------------------------ 8. execution gate (initial payment verified + explicit Sandbox window)
select ok(not private.job_execution_allowed('95000000-0000-4000-8000-000000000012'),'default policy: execution disabled even when paid');
select pg_temp.as_user(5);
set local role authenticated;
select lives_ok($$select public.payment_enable_sandbox_job('95000000-0000-4000-8000-000000000012',24,'Habilitación Sandbox acotada para la prueba')$$,'a superadmin enables Sandbox for job 1');
select lives_ok($$select public.payment_enable_sandbox_job('95000000-0000-4000-8000-000000000022',24,'Habilitación Sandbox acotada para la prueba')$$,'a superadmin enables Sandbox for job 2');
reset role;
select ok(private.job_execution_allowed('95000000-0000-4000-8000-000000000012'),'payment_required: verified initial payment + window allows execution');
select ok(not private.job_execution_allowed('95000000-0000-4000-8000-000000000022'),'payment_required: an unpaid order in review never allows execution');

-- ------------------------------------------------------------------ 9. cancellation after payment goes to financial review (PLAN 7.5)
select ok(exists(select 1 from pg_trigger where tgname='a_job_cancellation_payment_review' and tgrelid='public.jobs'::regclass and not tgisinternal),'cancellation review trigger is installed on jobs');
update public.jobs set status='cancelled',revision=revision+1 where id='95000000-0000-4000-8000-000000000012';
select is((select status||'/'||review_reason from private.payment_orders where job_id='95000000-0000-4000-8000-000000000012' and origin='initial'),'paid/job_cancelled','cancelling a paid job keeps the order paid and marks it for review');
select is((select payment_state from public.jobs where id='95000000-0000-4000-8000-000000000012'),'payment_review','the job projection shows the review');
select is((select count(*)::int from private.payment_events where order_id=(select id from private.payment_orders where job_id='95000000-0000-4000-8000-000000000012' and origin='initial') and validation='job_cancelled'),1,'one internal event records the reason');
select is((select count(*)::int from private.notification_outbox o join private.job_events e on e.id=o.event_id where e.job_id='95000000-0000-4000-8000-000000000012' and e.action='payment_review_required'),2,'one review notice per participant');
select ok(not private.job_execution_allowed('95000000-0000-4000-8000-000000000012'),'a cancelled/reviewed order never allows execution');
update public.jobs set status='cancelled',revision=revision+1 where id='95000000-0000-4000-8000-000000000012';
select is((select count(*)::int from private.payment_events where order_id=(select id from private.payment_orders where job_id='95000000-0000-4000-8000-000000000012' and origin='initial') and validation='job_cancelled'),1,'re-applying the cancellation does not duplicate the event');

-- ------------------------------------------------------------------ 10. retention of encrypted token material
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select is((public.payment_purge_sensitive(30))->>'attempts','0','a 30-day retention does not purge fresh material');
select ok((public.payment_purge_sensitive(0))->>'attempts' is not null,'the worker purges resolved material');
reset role;
select is((select (checkout_ciphertext is null and checkout_key_id is null)::text from private.payment_attempts where id=current_setting('s05.attempt1')::uuid),'true','the paid attempt no longer stores its checkout token');
select is((select (flow_order=5001 and commerce_order=current_setting('s05.commerce1') and state='paid')::text from private.payment_attempts where id=current_setting('s05.attempt1')::uuid),'true','identity, reference and state of the attempt are kept');
select is((select (token_ciphertext is not null)::text from private.payment_inbox where token_sha256=repeat('b',64)),'true','an unprocessed callback keeps its material');
select pg_temp.as_user(1);
set local role authenticated;
select throws_ok($$select public.payment_purge_sensitive(0)$$,'42501',null,'the browser cannot purge');
reset role;

select * from finish();
rollback;
