-- Local/staging only. All synthetic rows are rolled back; never run against production.
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
 ('10000000-0000-4000-8000-000000000001','customer-one@local.invalid','{"full_name":"Local Customer One","account_type":"superadmin","role":"superadmin"}'),
 ('10000000-0000-4000-8000-000000000002','customer-two@local.invalid','{"full_name":"Local Customer Two","account_type":"customer"}'),
 ('20000000-0000-4000-8000-000000000001','technician-one@local.invalid','{"full_name":"Local Technician One","account_type":"technician","category_ids":["electricidad"]}'),
 ('20000000-0000-4000-8000-000000000002','technician-two@local.invalid','{"full_name":"Local Technician Two","account_type":"technician","category_ids":["electricidad"]}');
select is((select role::text from public.profiles where id='10000000-0000-4000-8000-000000000001'),'customer','registration metadata cannot create a superadmin');
select is((select status::text from public.technician_profiles where user_id='20000000-0000-4000-8000-000000000001'),'pending_verification','technician registration stays pending');

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select lives_ok($$insert into public.service_requests(id,customer_id,category_id,title,description,location_label)
  values ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','electricidad','Solicitud local válida','Descripción local de prueba','Ñuñoa')$$,'customer creates a submitted own request');
select throws_ok($$insert into public.service_requests(customer_id,category_id,title,location_label,status)
  values ('10000000-0000-4000-8000-000000000001','electricidad','Estado manipulado','Ñuñoa','completed')$$,'42501',null,'customer cannot forge completed state');
select throws_ok($$insert into public.service_requests(customer_id,category_id,title,location_label,assigned_technician_id)
  values ('10000000-0000-4000-8000-000000000001','electricidad','Asignación manipulada','Ñuñoa','20000000-0000-4000-8000-000000000001')$$,'42501',null,'customer cannot preassign a technician');
select throws_ok($$select public.change_technician_status('20000000-0000-4000-8000-000000000001','verified','Unauthorized test')$$,'42501',null,'customer cannot approve technicians');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
select is((select count(*) from public.service_requests),0::bigint,'another customer cannot read the request');
reset role;

insert into storage.objects(bucket_id,name) values ('technician-documents','20000000-0000-4000-8000-000000000001/certificate.pdf');
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select is((select count(*) from storage.objects where bucket_id='technician-documents'),1::bigint,'technician can read own file metadata');
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
select is((select count(*) from storage.objects where bucket_id='technician-documents'),0::bigint,'another technician cannot read the file');
select throws_ok($$insert into storage.objects(bucket_id,name) values ('technician-documents','20000000-0000-4000-8000-000000000001/forged.pdf')$$,'42501',null,'cross-owner file upload rejected');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select throws_ok($$insert into storage.objects(bucket_id,name) values ('technician-documents','10000000-0000-4000-8000-000000000001/customer.pdf')$$,'42501',null,'customers cannot upload verification files');
reset role;
update public.technician_profiles set status='suspended' where user_id='20000000-0000-4000-8000-000000000002';
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select throws_ok($$insert into storage.objects(bucket_id,name) values ('technician-documents','20000000-0000-4000-8000-000000000002/suspended.pdf')$$,'42501',null,'suspended technician cannot upload');
reset role;

update public.profiles set role='moderator' where id='10000000-0000-4000-8000-000000000002';
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select is((select count(*) from storage.objects where bucket_id='technician-documents'),1::bigint,'moderator can inspect verification file metadata');
select lives_ok($$select public.change_technician_status('20000000-0000-4000-8000-000000000001','verified','Local authorized review')$$,'moderator uses guarded RPC after public helper execute was revoked');
select is((select count(*) from public.admin_audit_entries where technician_id='20000000-0000-4000-8000-000000000001' and actor_id='10000000-0000-4000-8000-000000000002' and previous_status='pending_verification' and next_status='verified'),1::bigint,'authorized approval preserves one attributable audit entry');
reset role;
select * from finish();
rollback;
