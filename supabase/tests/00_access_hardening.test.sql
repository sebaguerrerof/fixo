-- Authorized integration target only. All synthetic rows are rolled back.
begin;
set local search_path = public, extensions;
create extension if not exists pgtap with schema extensions;
select plan(27);

select ok(not has_table_privilege('anon','public.profiles','TRUNCATE'),'anon cannot truncate profiles');
select ok(not has_table_privilege('authenticated','public.service_requests','TRUNCATE'),'authenticated cannot truncate requests');
select ok(not has_table_privilege('authenticated','public.profiles','TRIGGER'),'authenticated cannot create profile triggers');
select ok(not has_function_privilege('anon','public.is_admin()','EXECUTE'),'public admin helper not executable by anon');
select ok(not has_function_privilege('authenticated','public.handle_new_user()','EXECUTE'),'registration trigger not callable by authenticated');
select ok(not has_function_privilege('anon','public.change_technician_status(uuid,public.technician_status,text)','EXECUTE'),'anon cannot execute admin status RPC');
select ok(has_function_privilege('authenticated','public.change_technician_status(uuid,public.technician_status,text)','EXECUTE'),'authenticated reaches guarded RPC');
select ok(not has_table_privilege('authenticated','public.service_requests','UPDATE'),'request state updates remain denied');
select ok(not has_table_privilege('anon','public.service_requests','INSERT'),'anon cannot insert requests');
select ok(not has_table_privilege('anon','public.service_requests','SELECT'),'anon cannot select requests');
select is((select file_size_limit from storage.buckets where id='technician-documents'),10485760::bigint,'verification files capped at 10 MiB');
select ok((select not public and allowed_mime_types = array['application/pdf','image/jpeg','image/png'] from storage.buckets where id='technician-documents'),'verification bucket private with explicit MIME allowlist');

-- Auth trigger is exercised, including an attempted role claim.
insert into auth.users(id,email,raw_user_meta_data) values
 ('10000000-0000-4000-8000-000000000001','customer-one@local.invalid','{"terms_accepted":true,"first_name":"Local","last_name":"Fixture","phone":"+56912345678","full_name":"Local Customer One","account_type":"superadmin","role":"superadmin"}'),
 ('10000000-0000-4000-8000-000000000002','customer-two@local.invalid','{"terms_accepted":true,"first_name":"Local","last_name":"Fixture","phone":"+56912345678","full_name":"Local Customer Two","account_type":"customer"}'),
 ('20000000-0000-4000-8000-000000000001','technician-one@local.invalid','{"terms_accepted":true,"first_name":"Local","last_name":"Fixture","phone":"+56912345678","full_name":"Local Technician One","account_type":"technician","category_ids":["electricidad"]}'),
 ('20000000-0000-4000-8000-000000000002','technician-two@local.invalid','{"terms_accepted":true,"first_name":"Local","last_name":"Fixture","phone":"+56912345678","full_name":"Local Technician Two","account_type":"technician","category_ids":["electricidad"]}');
update auth.users set email_confirmed_at=now() where id in ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002');
insert into auth.sessions(id,user_id,created_at,updated_at) select id,id,now(),now() from auth.users where id in ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002');
select is((select role::text from public.profiles where id='10000000-0000-4000-8000-000000000001'),'customer','registration metadata cannot create a superadmin');
select is((select status::text from public.technician_profiles where user_id='20000000-0000-4000-8000-000000000001'),'pending_verification','technician registration stays pending');

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
-- Sprint 03 retires direct INSERT; creation remains possible through the guarded atomic RPC.
select lives_ok($$select public.marketplace_create_request('30000000-0000-4000-8000-000000000001','{"categoryId":"electricidad","title":"Solicitud local válida","description":"Descripción local de prueba para publicar una solicitud","locationLabel":"Ñuñoa"}'::jsonb)$$,'customer publishes an own request through the authorized RPC');
select throws_ok($$insert into public.service_requests(customer_id,category_id,title,location_label,status)
  values ('10000000-0000-4000-8000-000000000001','electricidad','Estado manipulado','Ñuñoa','completed')$$,'42501',null,'customer cannot forge completed state');
select throws_ok($$insert into public.service_requests(customer_id,category_id,title,location_label,assigned_technician_id)
  values ('10000000-0000-4000-8000-000000000001','electricidad','Asignación manipulada','Ñuñoa','20000000-0000-4000-8000-000000000001')$$,'42501',null,'customer cannot preassign a technician');
select throws_ok($$select public.change_technician_status('20000000-0000-4000-8000-000000000001','verified','Unauthorized test')$$,'42501',null,'customer cannot approve technicians');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","session_id":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*) from public.service_requests),0::bigint,'another customer cannot read the request');
reset role;

insert into storage.objects(bucket_id,name) values ('technician-documents','20000000-0000-4000-8000-000000000001/certificate.pdf');
-- SQL fixture for access-policy tests; actual antivirus behavior has a separate native integration test.
insert into public.technician_documents(technician_id,document_type,storage_path,inspection_status)
values('20000000-0000-4000-8000-000000000001','certificate','20000000-0000-4000-8000-000000000001/certificate.pdf','clean');
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000001","session_id":"20000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*) from storage.objects where bucket_id='technician-documents'),1::bigint,'technician can read own file metadata');
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000002","session_id":"20000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*) from storage.objects where bucket_id='technician-documents'),0::bigint,'another technician cannot read the file');
select throws_ok($$insert into storage.objects(bucket_id,name) values ('technician-documents','20000000-0000-4000-8000-000000000001/forged.pdf')$$,'42501',null,'cross-owner file upload rejected');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select throws_ok($$insert into storage.objects(bucket_id,name) values ('technician-documents','10000000-0000-4000-8000-000000000001/customer.pdf')$$,'42501',null,'customers cannot upload verification files');
reset role;
update public.technician_profiles set status='suspended' where user_id='20000000-0000-4000-8000-000000000002';
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000002","session_id":"20000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$insert into storage.objects(bucket_id,name) values ('technician-documents','20000000-0000-4000-8000-000000000002/suspended.pdf')$$,'42501',null,'suspended technician cannot upload');
reset role;

update public.profiles set role='moderator' where id='10000000-0000-4000-8000-000000000002';
-- A reviewed application is now required even for the legacy guarded status RPC.
insert into private.category_requirements(id,category_id,requirement_key,version,kind,required,document_type,description,created_by)
values('74000000-0000-4000-8000-000000000001','electricidad','pgtap-access',1,'optional',false,'other','SQL policy fixture only','10000000-0000-4000-8000-000000000002');
update private.technician_applications set primary_category='electricidad',consent_at=now(),requirement_snapshot=array['74000000-0000-4000-8000-000000000001'::uuid],state='approved' where technician_id='20000000-0000-4000-8000-000000000001';
update private.technician_applications set approved_fingerprint=private.professional_fingerprint(technician_id) where technician_id='20000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","session_id":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*) from storage.objects where bucket_id='technician-documents' and name='20000000-0000-4000-8000-000000000001/certificate.pdf'),1::bigint,'moderator can inspect verification file metadata');
select lives_ok($$select public.change_technician_status('20000000-0000-4000-8000-000000000001','verified','Local authorized review')$$,'moderator uses guarded RPC after public helper execute was revoked');
select is((select count(*) from public.admin_audit_entries where technician_id='20000000-0000-4000-8000-000000000001' and actor_id='10000000-0000-4000-8000-000000000002' and previous_status='pending_verification' and next_status='verified'),1::bigint,'authorized approval preserves one attributable audit entry');
reset role;
select * from finish();
rollback;
