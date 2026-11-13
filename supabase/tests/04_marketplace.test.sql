-- Targeted Sprint 03 policy/transaction regression; fixtures always roll back.
begin;
set local search_path=public,extensions;
create extension if not exists pgtap with schema extensions;
select plan(25);
select ok(not has_table_privilege('authenticated','public.service_requests','INSERT'),'direct request INSERT retired');
select ok(not has_table_privilege('authenticated','public.quotes','UPDATE'),'quote UPDATE forbidden');
select ok(not has_table_privilege('authenticated','public.jobs','INSERT'),'arbitrary jobs forbidden');
select ok(not has_function_privilege('anon','public.marketplace_opportunities(text,integer)','EXECUTE'),'anonymous discovery forbidden');
select ok(not has_function_privilege('authenticated','public.claim_professional_inspection()','EXECUTE'),'queue worker restricted');
select ok((select not public from storage.buckets where id='service-request-photos'),'photos bucket private');
select is(private.normalized_commune('  ÑUÑOA  '),'nunoa','commune normalization includes uppercase accents');
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 ('93000000-0000-4000-8000-000000000001','sprint03-a@local.invalid',now(),'{"terms_accepted":true,"first_name":"Synthetic","last_name":"CustomerA","phone":"+56912345678"}'),
 ('93000000-0000-4000-8000-000000000002','sprint03-b@local.invalid',now(),'{"terms_accepted":true,"first_name":"Synthetic","last_name":"CustomerB","phone":"+56912345678"}');
insert into auth.sessions(id,user_id,created_at,updated_at) values
 ('93000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001',now(),now()),
 ('93000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000002',now(),now());
select set_config('request.jwt.claims','{"sub":"93000000-0000-4000-8000-000000000001","session_id":"93000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.marketplace_create_request('93000000-0000-4000-8000-000000000010','{"categoryId":"jardineria","title":"Solicitud sintética pgTAP","description":"Trabajo sintético de jardinería para verificar transacciones","locationLabel":"Ñuñoa","address":"Dirección sintética privada"}')$$,'publish atomic request');
select lives_ok($$select public.marketplace_create_request('93000000-0000-4000-8000-000000000010','{"categoryId":"jardineria","title":"Solicitud sintética pgTAP","description":"Trabajo sintético de jardinería para verificar transacciones","locationLabel":"Ñuñoa","address":"Dirección sintética privada"}')$$,'retry same request');
select is((select count(*) from public.service_requests where customer_id=auth.uid()),1::bigint,'retry creates one request');
select throws_ok($$select public.marketplace_create_request('93000000-0000-4000-8000-000000000010','{"title":"Different input"}')$$,'PT409',null,'operation reused with different payload rejected');
select throws_ok($$select public.marketplace_create_request(gen_random_uuid(),'{"categoryId":"jardineria","title":"Solicitud sintética","description":"Descripción de una solicitud sintética suficientemente larga","locationLabel":"Ñuñoa","status":"completed"}')$$,'22023',null,'overposting rejected');
select throws_ok($$update public.service_requests set status='completed' where customer_id=auth.uid()$$,'42501',null,'generic privileged transition rejected');
select throws_ok($$select * from private.service_request_details$$,'42501',null,'private details not exposed by grants');
select is((public.marketplace_customer_requests()->>'total')::integer,1,'paginated total real');
select is((public.marketplace_customer_requests()->'items'->0->>'quote_count')::integer,0,'no fabricated quote count');
select throws_ok($$select public.marketplace_customer_requests(0)$$,'22023',null,'page bounds enforced');
select throws_ok($$select public.marketplace_opportunities()$$,'42501',null,'customer cannot discover technician feed');
select throws_ok($$select public.marketplace_admin_requests()$$,'42501',null,'customer cannot supervise platform');
reset role;
create temporary table sprint03_request as select id from public.service_requests where customer_id='93000000-0000-4000-8000-000000000001';
grant select on sprint03_request to authenticated;
select set_config('request.jwt.claims','{"sub":"93000000-0000-4000-8000-000000000002","session_id":"93000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*) from public.service_requests where id=(select id from sprint03_request)),0::bigint,'customer B cannot REST-select A request');
select ok(public.marketplace_request_detail((select id from sprint03_request)) is null,'customer B detail RPC fails closed with unassigned technician');
select throws_ok($$select public.marketplace_cancel_request((select id from sprint03_request),1)$$,'42501',null,'customer B cannot cancel A request');
select set_config('request.jwt.claims','{"sub":"93000000-0000-4000-8000-000000000001","session_id":"93000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($$select public.marketplace_cancel_request((select id from sprint03_request),1)$$,'owner cancels open request');
select lives_ok($$select public.marketplace_cancel_request((select id from sprint03_request),1)$$,'cancel retry idempotent');
select is(public.marketplace_request_detail((select id from sprint03_request))->>'status','cancelled','cancellation persists');
reset role;
select * from finish();
rollback;
