-- Synthetic fixtures, isolated Supabase only. This entire test rolls back.
begin;
set local search_path=public,extensions;
create extension if not exists pgtap with schema extensions;
select no_plan();
select throws_ok($$insert into auth.users(id,email,raw_user_meta_data) values('41000000-0000-4000-8000-000000000099','no-consent@local.invalid','{"first_name":"Local","last_name":"Fixture","phone":"+56912345678","terms_accepted":false}')$$,'22023',null,'signup without consent rejected transactionally');
select throws_ok($$insert into auth.users(id,email,raw_user_meta_data) values('41000000-0000-4000-8000-000000000098','no-phone@local.invalid','{"first_name":"Local","last_name":"Fixture","terms_accepted":true}')$$,'22023',null,'signup without contact rejected transactionally');
select throws_ok($$insert into auth.users(id,email,raw_user_meta_data) values('41000000-0000-4000-8000-000000000097','invalid-phone@local.invalid','{"first_name":"Local","last_name":"Fixture","phone":"--------","terms_accepted":true}')$$,'22023',null,'punctuation-only phone rejected in database');
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('41000000-0000-4000-8000-000000000001','s1-customer@local.invalid',now(),'{"terms_accepted":true,"first_name":"Local","last_name":"Fixture","phone":"+56912345678","full_name":"Customer One","role":"superadmin","account_type":"superadmin"}'),
('41000000-0000-4000-8000-000000000002','s1-other@local.invalid',now(),'{"terms_accepted":true,"first_name":"Local","last_name":"Fixture","phone":"+56912345678","full_name":"Customer Two"}'),
('41000000-0000-4000-8000-000000000003','s1-technician@local.invalid',now(),'{"terms_accepted":true,"first_name":"Local","last_name":"Fixture","phone":"+56912345678","full_name":"Technician One","account_type":"technician","years_of_experience":"999999999999999999999999999","starting_price_clp":"999999999999999999999","category_ids":{},"specialties":false,"coverage_areas":42,"emergency_enabled":"invalid"}'),
('41000000-0000-4000-8000-000000000004','s1-moderator@local.invalid',now(),'{"terms_accepted":true,"first_name":"Local","last_name":"Fixture","phone":"+56912345678","full_name":"Moderator One"}'),
('41000000-0000-4000-8000-000000000005','s1-admin-one@local.invalid',now(),'{"terms_accepted":true,"first_name":"Local","last_name":"Fixture","phone":"+56912345678","full_name":"Administrator One"}'),
('41000000-0000-4000-8000-000000000006','s1-admin-two@local.invalid',now(),'{"terms_accepted":true,"first_name":"Local","last_name":"Fixture","phone":"+56912345678","full_name":"Administrator Two"}');
insert into auth.sessions(id,user_id,created_at,updated_at) select id,id,now(),now() from auth.users where email like 's1-%@local.invalid';
update public.profiles set role='moderator' where id='41000000-0000-4000-8000-000000000004';
update public.profiles set role='superadmin' where id in ('41000000-0000-4000-8000-000000000005','41000000-0000-4000-8000-000000000006');
select is((select role::text from public.profiles where id='41000000-0000-4000-8000-000000000001'),'customer','metadata cannot assign privileged roles');
select is((select status::text from public.technician_profiles where user_id='41000000-0000-4000-8000-000000000003'),'pending_verification','malformed technician metadata handled and remains pending');
select is((select years_of_experience from public.technician_profiles where user_id='41000000-0000-4000-8000-000000000003'),0,'overflowing years do not crash registration');
select ok(not has_table_privilege('authenticated','private.account_details','SELECT'),'private contacts not readable directly');
select ok(not has_table_privilege('anon','private.user_invitations','SELECT'),'invitations not public');
select ok(not has_function_privilege('authenticated','public.issue_auth_flow(text,uuid,uuid,text)','EXECUTE'),'users cannot issue recovery proofs');
select ok(not has_function_privilege('authenticated','public.finish_invitation_delivery(uuid,integer,uuid,text)','EXECUTE'),'users cannot confirm invitation delivery');

select set_config('request.jwt.claims','{"sub":"41000000-0000-4000-8000-000000000001","session_id":"41000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is(public.my_account_access()->>'allowed','true','live customer session allowed');
select throws_ok($$update public.profiles set role='superadmin' where id=auth.uid()$$,'42501',null,'direct self role update denied');
select throws_ok($$update public.profiles set account_status='active' where id=auth.uid()$$,'42501',null,'direct status update denied');
select lives_ok($$select public.update_my_profile('Cliente','Local','+56912345678',null)$$,'own allowed profile fields update');
select is(public.my_profile()->>'phone','+56912345678','own phone returned by scoped RPC');
select throws_ok($$select public.admin_list_users()$$,'42501',null,'customer cannot enumerate accounts');
select throws_ok($$select public.admin_change_account('41000000-0000-4000-8000-000000000002','blocked',null,'Unauthorized test','51000000-0000-4000-8000-000000000001')$$,'42501',null,'customer cannot block others');
select throws_ok($$select public.admin_reserve_invitation('illegal@local.invalid','Illegal Invite','superadmin','51000000-0000-4000-8000-000000000002',false)$$,'42501',null,'customer cannot invite administrators');
select is((select count(*) from public.profiles where id='41000000-0000-4000-8000-000000000002'),0::bigint,'other customer profile private');
reset role;

select set_config('request.jwt.claims','{"sub":"41000000-0000-4000-8000-000000000004","session_id":"41000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select is(jsonb_array_length(public.admin_list_users()->'users'),6,'moderator lists real accounts');
select throws_ok($$select public.admin_change_account('41000000-0000-4000-8000-000000000005','suspended',null,'Unauthorized admin suspension','51000000-0000-4000-8000-000000000003')$$,'42501',null,'moderator cannot suspend administrators');
select throws_ok($$select public.admin_change_account('41000000-0000-4000-8000-000000000002',null,'moderator','Unauthorized role change','51000000-0000-4000-8000-000000000004')$$,'42501',null,'moderator cannot change roles');
select throws_ok($$select public.admin_reserve_invitation('illegal@local.invalid','Illegal Invite','superadmin','51000000-0000-4000-8000-000000000005',false)$$,'42501',null,'moderator cannot invite privileged roles');
select lives_ok($$select public.admin_change_account('41000000-0000-4000-8000-000000000001','suspended',null,'Local suspension test','51000000-0000-4000-8000-000000000006')$$,'moderator suspends customer transactionally');
select lives_ok($$select public.admin_change_account('41000000-0000-4000-8000-000000000001','suspended',null,'Local suspension test','51000000-0000-4000-8000-000000000006')$$,'same operation retries safely');
reset role;
select is((select count(*) from private.account_events where request_id='51000000-0000-4000-8000-000000000006'),1::bigint,'one audit entry for retry');
select set_config('request.jwt.claims','{"sub":"41000000-0000-4000-8000-000000000001","session_id":"41000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is(public.my_account_access()->>'allowed','false','old JWT cannot bypass suspension');
select throws_ok($$select public.update_my_profile('Forged','Active','+56912345678',null)$$,'42501',null,'suspended profile update denied');
select throws_ok($$insert into public.service_requests(customer_id,category_id,title,location_label) values(auth.uid(),'electricidad','Solicitud suspendida','Ñuñoa')$$,'42501',null,'suspended customer cannot create requests');
reset role;

select set_config('request.jwt.claims','{"sub":"41000000-0000-4000-8000-000000000005","session_id":"41000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.admin_change_account('41000000-0000-4000-8000-000000000001','active',null,'Local reactivation test','51000000-0000-4000-8000-000000000007')$$,'superadmin reactivates customer');
select lives_ok($$select public.admin_change_account('41000000-0000-4000-8000-000000000006','blocked',null,'Local admin blocking test','51000000-0000-4000-8000-000000000008')$$,'superadmin manages another admin');
select throws_ok($$select public.admin_change_account('41000000-0000-4000-8000-000000000005','blocked',null,'Self disable test','51000000-0000-4000-8000-000000000009')$$,'42501',null,'last active superadmin cannot disable itself');
select throws_ok($$select public.admin_change_account('41000000-0000-4000-8000-000000000005',null,'customer','Self demotion test','51000000-0000-4000-8000-000000000010')$$,'42501',null,'self role changes prohibited');
select lives_ok($$select public.admin_change_account('41000000-0000-4000-8000-000000000002',null,'moderator','Local role assignment test','51000000-0000-4000-8000-000000000011')$$,'superadmin assigns privileged role');
reset role;
select set_config('request.jwt.claims','{"sub":"41000000-0000-4000-8000-000000000006","session_id":"41000000-0000-4000-8000-000000000006","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.admin_change_account('41000000-0000-4000-8000-000000000005','blocked',null,'Stale admin token test','51000000-0000-4000-8000-000000000012')$$,'42501',null,'blocked admin with old token cannot remove last administrator');
reset role;

select set_config('request.jwt.claims','{"sub":"41000000-0000-4000-8000-000000000005","session_id":"41000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
set local role authenticated;
select is(public.admin_reserve_invitation('s1-invite@local.invalid','Invited Technician','technician','51000000-0000-4000-8000-000000000013',false)->>'send','true','authorized invitation reserved');
select is(public.admin_reserve_invitation('s1-invite@local.invalid','Invited Technician','technician','51000000-0000-4000-8000-000000000013',false)->>'send','false','same invitation never sends twice');
select is(public.admin_reserve_invitation('s1-invite@local.invalid','Invited Technician','technician','51000000-0000-4000-8000-000000000014',false)->>'send','false','duplicate email with different operation does not resend');
select throws_ok($$select public.admin_reserve_invitation('s1-invite@local.invalid','Invited Technician','technician','51000000-0000-4000-8000-000000000015',true)$$,'P0001',null,'resend cooldown enforced');
reset role;
insert into auth.users(id,email,email_confirmed_at,invited_at,raw_user_meta_data) values('41000000-0000-4000-8000-000000000007','s1-invite@local.invalid',now(),now(),'{"terms_accepted":true,"first_name":"Local","last_name":"Fixture","phone":"+56912345678","full_name":"Invited Technician","role":"superadmin","account_type":"superadmin"}');
insert into auth.sessions(id,user_id,created_at,updated_at) values('41000000-0000-4000-8000-000000000007','41000000-0000-4000-8000-000000000007',now(),now());
select is((select role::text from public.profiles where id='41000000-0000-4000-8000-000000000007'),'customer','invite metadata cannot assign role');
select set_config('request.jwt.claims','{"sub":"41000000-0000-4000-8000-000000000007","session_id":"41000000-0000-4000-8000-000000000007","role":"authenticated"}',true);
set local role authenticated;
select is(public.my_account_access()->>'allowed','false','pending invited identity cannot operate');
select lives_ok($$select public.accept_my_invitation('Invitado','Local','+56912345678',true)$$,'verified invited identity completes profile');
select is(public.my_account_access()->>'role','technician','accepted invitation assigns stored role');
select is(public.my_account_access()->>'allowed','true','accepted invited identity allowed');
reset role;
select is((select status::text from public.technician_profiles where user_id='41000000-0000-4000-8000-000000000007'),'pending_verification','invited technician never auto approved');
select set_config('request.jwt.claims','{"sub":"41000000-0000-4000-8000-000000000005","session_id":"41000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
set local role authenticated;
select is(public.admin_reserve_invitation('s1-expire@local.invalid','Expired Invite','customer','51000000-0000-4000-8000-000000000016',false)->>'send','true','second invitation reserved');
reset role;
update private.user_invitations set expires_at=now()-interval '1 second' where email='s1-expire@local.invalid';
insert into auth.users(id,email,email_confirmed_at,invited_at,raw_user_meta_data) values('41000000-0000-4000-8000-000000000008','s1-expire@local.invalid',now(),now(),'{"terms_accepted":true,"first_name":"Local","last_name":"Fixture","phone":"+56912345678","full_name":"Expired Identity"}');
insert into auth.sessions(id,user_id,created_at,updated_at) values('41000000-0000-4000-8000-000000000008','41000000-0000-4000-8000-000000000008',now(),now());
select set_config('request.jwt.claims','{"sub":"41000000-0000-4000-8000-000000000008","session_id":"41000000-0000-4000-8000-000000000008","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.accept_my_invitation('Expired','Identity','+56912345678',true)$$,'42501',null,'expired invitation cannot be accepted');
reset role;
select set_config('request.jwt.claims','{"sub":"41000000-0000-4000-8000-000000000005","session_id":"41000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
set local role authenticated;
select is((select value->>'state' from jsonb_array_elements(public.admin_list_invitations()) value where value->>'email'='s1-expire@local.invalid'),'expired','expiry is visible and not fabricated');
select lives_ok($$select public.admin_revoke_invitation((select (value->>'id')::uuid from jsonb_array_elements(public.admin_list_invitations()) value where value->>'email'='s1-expire@local.invalid'),'Local revoke test')$$,'expired invitation can be revoked');
reset role;
select set_config('request.jwt.claims','{"sub":"41000000-0000-4000-8000-000000000008","session_id":"41000000-0000-4000-8000-000000000008","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.accept_my_invitation('Expired','Identity','+56912345678',true)$$,'42501',null,'revoked invitation cannot be accepted');
reset role;
-- Approved professional profile is hidden as soon as the global account is suspended.
update public.technician_profiles set status='active' where user_id='41000000-0000-4000-8000-000000000003';
select set_config('request.jwt.claims','{}',true);
set local role anon;
select is((select count(*) from public.technician_profiles where user_id='41000000-0000-4000-8000-000000000003'),1::bigint,'approved active technician visible');
reset role;
update public.profiles set account_status='suspended' where id='41000000-0000-4000-8000-000000000003';
set local role anon;
select is((select count(*) from public.technician_profiles where user_id='41000000-0000-4000-8000-000000000003'),0::bigint,'global suspension immediately removes directory visibility');
reset role;
delete from auth.sessions where id='41000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims','{"sub":"41000000-0000-4000-8000-000000000001","session_id":"41000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is(public.my_account_access()->>'allowed','false','revoked session cannot use an old JWT');
reset role;
select * from finish();
rollback;
