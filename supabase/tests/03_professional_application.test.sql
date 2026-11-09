-- SQL authorization/regression checks only; binary/antivirus tests use actual Storage HTTP separately.
begin;
set local search_path=public,extensions;
create extension if not exists pgtap with schema extensions;
select plan(18);
select is((select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname in('category_requirements','technician_applications','professional_events') and c.relrowsecurity),3::bigint,'all professional private tables have RLS');
select ok(not has_table_privilege('authenticated','private.technician_applications','SELECT'),'applications have no direct authenticated grant');
select ok(not has_function_privilege('authenticated','public.record_professional_inspection(uuid,text,text,integer,text,text)','EXECUTE'),'ordinary JWT cannot forge scan results');
select ok(not has_function_privilege('anon','public.admin_professional_queue(text,text)','EXECUTE'),'anonymous users cannot enumerate applications');
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('43000000-0000-4000-8000-000000000001','professional-admin@local.invalid',now(),'{"terms_accepted":true,"first_name":"Synthetic","last_name":"Admin","phone":"+56912345678"}'),
('43000000-0000-4000-8000-000000000002','professional-tech@local.invalid',now(),'{"terms_accepted":true,"first_name":"Synthetic","last_name":"Technician","phone":"+56912345678","account_type":"technician"}'),
('43000000-0000-4000-8000-000000000003','professional-other@local.invalid',now(),'{"terms_accepted":true,"first_name":"Synthetic","last_name":"Other","phone":"+56912345678"}');
update public.profiles set role='superadmin' where id='43000000-0000-4000-8000-000000000001';
insert into auth.sessions(id,user_id,created_at,updated_at) select id,id,now(),now() from auth.users where id in('43000000-0000-4000-8000-000000000001','43000000-0000-4000-8000-000000000002','43000000-0000-4000-8000-000000000003');
select set_config('request.jwt.claims','{"sub":"43000000-0000-4000-8000-000000000001","session_id":"43000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.admin_version_requirement('electricidad','pgtap-professional','internal',true,'identity','Synthetic SQL requirement',null,'Synthetic SQL configuration')$$,'superadmin configures a criterion');
select lives_ok($$select public.admin_version_requirement('electricidad','pgtap-professional','internal',true,'identity','Synthetic SQL requirement',null,'Synthetic SQL configuration')$$,'same criterion retry is safe');
select throws_ok($$select public.admin_version_requirement('electricidad','pgtap-legal','legal',true,'license','No legal source',null,'Synthetic rejection test')$$,'23514',null,'legal requirement without source rejected');
select throws_ok($$select public.admin_decide_professional_application('43000000-0000-4000-8000-000000000001','approved',1,'Self review denied','53000000-0000-4000-8000-000000000001')$$,'42501',null,'self review denied');
reset role;
select is((select count(*) from private.category_requirements where requirement_key='pgtap-professional'),1::bigint,'retry never invents a second requirement version');
-- Privileged SQL fixtures isolate publication rules; they do not claim to scan binary files.
update private.technician_applications set primary_category='electricidad',consent_at=now(),state='approved',
requirement_snapshot=array(select id from private.category_requirements where category_id='electricidad' and active order by id)
where technician_id='43000000-0000-4000-8000-000000000002';
insert into public.technician_documents(technician_id,document_type,storage_path,requirement_id,status,inspection_status)
select '43000000-0000-4000-8000-000000000002',document_type,'43000000-0000-4000-8000-000000000002/'||id||'.pdf',id,'approved','clean'
from private.category_requirements where category_id='electricidad' and active and required;
update private.technician_applications set approved_fingerprint=private.professional_fingerprint(technician_id) where technician_id='43000000-0000-4000-8000-000000000002';
update public.technician_profiles set status='active' where user_id='43000000-0000-4000-8000-000000000002';
select ok(private.public_technician('43000000-0000-4000-8000-000000000002'),'reviewed snapshot and clean approved metadata permit publication');
update public.profiles set full_name='Synthetic Changed Identity' where id='43000000-0000-4000-8000-000000000002';
select is((select state from private.technician_applications where technician_id='43000000-0000-4000-8000-000000000002'),'draft','sensitive identity change invalidates reviewed application');
select ok(not private.public_technician('43000000-0000-4000-8000-000000000002'),'sensitive edit removes public visibility');
update private.technician_applications set state='approved',approved_fingerprint=private.professional_fingerprint(technician_id) where technician_id='43000000-0000-4000-8000-000000000002';
set local role authenticated;
select public.admin_version_requirement('electricidad','pgtap-professional','internal',true,'identity','Synthetic revised criterion',null,'Synthetic requirement version change');
reset role;
select ok(not private.public_technician('43000000-0000-4000-8000-000000000002'),'new criteria version immediately invalidates old approval snapshot');
select is((select count(*) from private.category_requirements where requirement_key='pgtap-professional'),2::bigint,'new criterion preserves both versions');
select is((select description from private.category_requirements where requirement_key='pgtap-professional' and version=1),'Synthetic SQL requirement','previous criterion content remains immutable');
select set_config('request.jwt.claims','{"sub":"43000000-0000-4000-8000-000000000003","session_id":"43000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.professional_application('43000000-0000-4000-8000-000000000002')$$,'42501',null,'cross-user application read denied');
reset role;
delete from private.technician_applications where technician_id='43000000-0000-4000-8000-000000000002';
select set_config('request.jwt.claims','{"sub":"43000000-0000-4000-8000-000000000002","session_id":"43000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.save_professional_application('{}',1,'53000000-0000-4000-8000-000000000002')$$,'PT409',null,'missing application fails without retryable SQLSTATE or side effects');
reset role;
select is((select count(*) from private.professional_events where technician_id='43000000-0000-4000-8000-000000000002' and action='draft_saved'),0::bigint,'missing application creates no misleading draft audit record');
select * from finish();
rollback;
