-- Sprint 04 CI regression. SQL fixture identities only; all writes roll back.
begin;
set local search_path=public,extensions;
create extension if not exists pgtap with schema extensions;
select plan(30);
select ok(not has_table_privilege('authenticated','public.jobs','UPDATE'),'no generic authenticated job UPDATE');
select ok(not has_table_privilege('service_role','public.jobs','UPDATE'),'service role cannot bypass job commands');
select is((select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private'and c.relname=any(array['job_execution_policies','job_schedule_proposals','job_cancellations','job_incidents','job_incident_messages','job_events','job_operations','notification_outbox','job_incident_attachments'])and c.relrowsecurity),9::bigint,'all operational tables use RLS');
select ok(not has_table_privilege('authenticated','private.job_execution_policies','UPDATE'),'browser cannot enable pilot');
select ok(not has_function_privilege('authenticated','public.claim_job_notification()','EXECUTE'),'worker claim restricted');
select ok(not has_function_privilege('anon','public.job_command(uuid,uuid,integer,text,jsonb)','EXECUTE'),'anonymous command denied');
select ok((select not public from storage.buckets where id='job-incident-evidence'),'incident evidence private');
select is((select file_size_limit from storage.buckets where id='job-incident-evidence'),4194304::bigint,'evidence limit enforced');
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)values
 ('94000000-0000-4000-8000-000000000001','s04-customer@local.invalid',now(),'{"first_name":"Synthetic","last_name":"Customer","phone":"+56912345678","terms_accepted":true}'),
 ('94000000-0000-4000-8000-000000000002','s04-tech@local.invalid',now(),'{"first_name":"Synthetic","last_name":"Technician","phone":"+56912345678","terms_accepted":true,"account_type":"technician"}'),
 ('94000000-0000-4000-8000-000000000003','s04-other@local.invalid',now(),'{"first_name":"Synthetic","last_name":"Other","phone":"+56912345678","terms_accepted":true}'),
 ('94000000-0000-4000-8000-000000000004','s04-moderator@local.invalid',now(),'{"first_name":"Synthetic","last_name":"Moderator","phone":"+56912345678","terms_accepted":true}');
update public.profiles set role='moderator'where id='94000000-0000-4000-8000-000000000004';
insert into auth.sessions(id,user_id,created_at,updated_at)select id,id,now(),now()from auth.users where id in('94000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000002','94000000-0000-4000-8000-000000000003','94000000-0000-4000-8000-000000000004');
select set_config('request.jwt.claims','{"sub":"94000000-0000-4000-8000-000000000001","session_id":"94000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
create temporary table sprint04_request as select(public.marketplace_create_request('94000000-0000-4000-8000-000000000010','{"categoryId":"jardineria","title":"Trabajo sintético pgTAP S04","description":"Solicitud sintética para verificar operaciones de trabajo","locationLabel":"Ñuñoa","address":"Dirección sintética privada"}')->>'id')::uuid id;
insert into public.quotes(id,service_request_id,technician_id,labor_clp,description,estimated_duration,available_date,expires_at,status)select '94000000-0000-4000-8000-000000000011',id,'94000000-0000-4000-8000-000000000002',25000,'Trabajo sintético para regresión SQL','2 horas',now()+interval '2 days',now()+interval '3 days','accepted'from sprint04_request;
insert into public.jobs(id,service_request_id,quote_id,customer_id,technician_id,snapshot)select '94000000-0000-4000-8000-000000000012',id,'94000000-0000-4000-8000-000000000011','94000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000002','{"priceClp":25000,"currency":"CLP"}'from sprint04_request;
select is((select mode from private.job_execution_policies where job_id='94000000-0000-4000-8000-000000000012'),'disabled','new job execution disabled');
select is((select count(*)from private.notification_outbox o join private.job_events e on e.id=o.event_id where e.job_id='94000000-0000-4000-8000-000000000012'),4::bigint,'award emits two events for both participants');
select throws_ok($$update public.jobs set snapshot='{}',revision=revision+1 where id='94000000-0000-4000-8000-000000000012'$$,'PT409',null,'accepted snapshot immutable');
select throws_ok($$update public.jobs set payment_state='paid',revision=revision+1 where id='94000000-0000-4000-8000-000000000012'$$,'PT409',null,'operations cannot mark paid');
set local role authenticated;
select is(public.job_detail('94000000-0000-4000-8000-000000000012')->'job'->>'status','awarded','owner reads job history');
select set_config('request.jwt.claims','{"sub":"94000000-0000-4000-8000-000000000003","session_id":"94000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select ok(public.job_detail('94000000-0000-4000-8000-000000000012')is null,'third party cannot read');
select throws_ok($$select public.job_command('94000000-0000-4000-8000-000000000012',gen_random_uuid(),1,'start')$$,'42501',null,'third party cannot command');
select set_config('request.jwt.claims','{"sub":"94000000-0000-4000-8000-000000000001","session_id":"94000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
reset role;
create function pg_temp.s04_window()returns jsonb language sql stable set search_path=pg_catalog as $$select jsonb_build_object('startsAt',to_jsonb(d),'endsAt',to_jsonb(d+interval '1 hour'),'localDate',to_char(d at time zone 'America/Santiago','YYYY-MM-DD'),'startTime',to_char(d at time zone 'America/Santiago','HH24:MI'),'endTime',to_char((d+interval '1 hour')at time zone 'America/Santiago','HH24:MI'),'reason','Synthetic schedule proposal')from(select date_trunc('day',now()at time zone 'UTC')at time zone 'UTC'+interval '2 days 15 hours' d)x$$;
set local role authenticated;
select lives_ok($$select public.job_command('94000000-0000-4000-8000-000000000012','94000000-0000-4000-8000-000000000020',1,'propose_schedule',pg_temp.s04_window())$$,'owner proposes Santiago schedule');
select is((public.job_detail('94000000-0000-4000-8000-000000000012')->'job'->>'revision')::integer,2,'revision increments');
select lives_ok($$select public.job_command('94000000-0000-4000-8000-000000000012','94000000-0000-4000-8000-000000000020',1,'propose_schedule',pg_temp.s04_window())$$,'lost response replay accepted');
select is(jsonb_array_length(public.job_detail('94000000-0000-4000-8000-000000000012')->'schedules'),1,'retry does not duplicate schedule');
select throws_ok($$select public.job_command('94000000-0000-4000-8000-000000000012',gen_random_uuid(),2,'start','{"mode":"authorized_pilot"}')$$,'22023',null,'payload cannot enable execution');
select throws_ok($$select public.job_command('94000000-0000-4000-8000-000000000012',gen_random_uuid(),1,'propose_schedule',pg_temp.s04_window())$$,'PT409',null,'stale version conflict deterministic');
select throws_ok($$select public.job_command('94000000-0000-4000-8000-000000000012',gen_random_uuid(),2,'accept_schedule',jsonb_build_object('proposalId',public.job_detail('94000000-0000-4000-8000-000000000012')->'schedules'->0->>'id'))$$,'42501',null,'proposer cannot self-confirm');
select lives_ok($$select public.job_command('94000000-0000-4000-8000-000000000012',gen_random_uuid(),2,'request_cancellation','{"reason":"Synthetic cancellation before execution"}')$$,'participant requests cancellation');
select throws_ok($$select public.job_command('94000000-0000-4000-8000-000000000012',gen_random_uuid(),3,'propose_schedule',pg_temp.s04_window())$$,'PT409',null,'pending cancellation blocks ordinary changes');
select lives_ok($$select public.job_command('94000000-0000-4000-8000-000000000012',gen_random_uuid(),3,'open_incident','{"kind":"other","description":"Synthetic support case while cancellation is reviewed."}')$$,'participant can request support');
select set_config('request.jwt.claims','{"sub":"94000000-0000-4000-8000-000000000004","session_id":"94000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select throws_ok($$select public.job_command('94000000-0000-4000-8000-000000000012',gen_random_uuid(),4,'start')$$,'42501',null,'moderator cannot impersonate technician');
select lives_ok($$select public.job_command('94000000-0000-4000-8000-000000000012',gen_random_uuid(),4,'resolve_incident',jsonb_build_object('incidentId',public.job_detail('94000000-0000-4000-8000-000000000012')->'incidents'->0->>'id','message','Synthetic operational resolution without refund'))$$,'moderator resolves support');
select lives_ok($$select public.job_command('94000000-0000-4000-8000-000000000012',gen_random_uuid(),5,'resolve_cancellation',jsonb_build_object('cancellationId',public.job_detail('94000000-0000-4000-8000-000000000012')->'cancellations'->0->>'id','decision','approved','reason','Synthetic cancellation approved before start'))$$,'moderator cancels before start');
select is(public.job_detail('94000000-0000-4000-8000-000000000012')->'job'->>'status','cancelled','cancelled state persists');
select is(public.job_detail('94000000-0000-4000-8000-000000000012')->'job'->>'payment_state','not_enabled','financial state remains independent');
reset role;
select *from finish();
rollback;
