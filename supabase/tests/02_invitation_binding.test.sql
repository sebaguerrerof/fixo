-- Authorized integration target; isolated synthetic transaction always rolls back.
begin;
set local search_path=public,extensions;
create extension if not exists pgtap with schema extensions;
select plan(7);
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('42000000-0000-4000-8000-000000000001','binding-admin@local.invalid',now(),'{"terms_accepted":true,"first_name":"Synthetic","last_name":"Admin","phone":"+56912345678"}');
update public.profiles set role='superadmin' where id='42000000-0000-4000-8000-000000000001';
insert into private.user_invitations(email,full_name,role,actor_id,request_id) values
('binding-invite@local.invalid','Synthetic Invite','technician','42000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000001');
select lives_ok($$insert into auth.users(id,email,raw_user_meta_data) values('42000000-0000-4000-8000-000000000002','binding-invite@local.invalid','{"full_name":"Synthetic Invite","role":"superadmin"}')$$,'Auth invite inserts before invited_at without demanding registration consent');
select is((select user_id from private.user_invitations where email='binding-invite@local.invalid'),'42000000-0000-4000-8000-000000000002'::uuid,'private reservation binds on insert');
update auth.users set invited_at=now(),email_confirmed_at=now() where id='42000000-0000-4000-8000-000000000002';
insert into auth.sessions(id,user_id,created_at,updated_at) values('42000000-0000-4000-8000-000000000002','42000000-0000-4000-8000-000000000002',now(),now());
select set_config('request.jwt.claims','{"sub":"42000000-0000-4000-8000-000000000002","session_id":"42000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select is(public.my_account_access()->>'allowed','false','pending identity cannot operate');
reset role;
update private.user_invitations set user_id=null where email='binding-invite@local.invalid';
set local role authenticated;
select is(public.my_account_access()->>'allowed','false','unbound delivery race also fails closed');
select is(public.my_account_access()->>'invitation_pending','true','UI can direct unbound identity to completion');
reset role;
update private.user_invitations set user_id='42000000-0000-4000-8000-000000000002' where email='binding-invite@local.invalid';
set local role authenticated;
select lives_ok($$select public.accept_my_invitation('Synthetic','Invited','+56912345678',true)$$,'consent and verified identity complete reserved invitation');
select is(public.my_account_access()->>'allowed','true','accepted invitation unlocks account');
reset role;
select * from finish();
rollback;
