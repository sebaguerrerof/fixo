-- Sprint 05 (Sandbox rollout): Flow Sandbox payments are available ONLY to explicitly authorized SYNTHETIC accounts.
-- Enforced in the database (the source of truth) and mirrored in the UI. Independent of, and in addition to, the global switches and the per-job
-- Sandbox window. A real customer can never prepare, reserve or reopen a Sandbox payment, whatever the environment switches say.
--  * An account is "synthetic" when its Auth email ends in the reserved, non-routable `.invalid` TLD (RFC 2606): no real mailbox can have it.
--  * Only a superadmin authorizes/revokes, with a reason; the history is kept (one row per account, revocation timestamps).
create table private.payment_sandbox_accounts(
 user_id uuid primary key references public.profiles(id),
 authorized_by uuid not null references public.profiles(id),
 reason text not null check(length(trim(reason)) between 10 and 1000),
 authorized_at timestamptz not null default now(),
 revoked_at timestamptz, revoked_by uuid references public.profiles(id), revoke_reason text check(revoke_reason is null or length(trim(revoke_reason)) between 10 and 1000),
 check((revoked_at is null)=(revoked_by is null) and (revoked_at is null)=(revoke_reason is null))
);
-- The row above is only the CURRENT state. Every authorization, re-authorization and revocation is also recorded here, append-only (actor, date, reason).
create table private.payment_sandbox_account_events(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id),
 action text not null check(action in('authorized','reauthorized','revoked')),
 actor_id uuid not null references public.profiles(id),
 reason text not null check(length(trim(reason)) between 10 and 1000),
 created_at timestamptz not null default clock_timestamp()   -- real wall-clock order even inside one transaction
);
create index payment_sandbox_account_events_user_idx on private.payment_sandbox_account_events(user_id,created_at);
create function private.payment_sandbox_account_events_append_only()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin raise exception 'El historial de autorizaciones Sandbox es inmutable' using errcode='PT409'; end; $$;
create trigger payment_sandbox_account_events_append_only before update or delete on private.payment_sandbox_account_events for each row execute function private.payment_sandbox_account_events_append_only();
alter table private.payment_sandbox_account_events enable row level security;
revoke all on private.payment_sandbox_account_events from public,anon,authenticated,service_role;
alter table private.payment_sandbox_accounts enable row level security;
revoke all on private.payment_sandbox_accounts from public,anon,authenticated,service_role;

create function private.payment_sandbox_account_allowed(target uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from private.payment_sandbox_accounts a join public.profiles p on p.id=a.user_id join auth.users u on u.id=a.user_id
  where a.user_id=target and a.revoked_at is null and p.account_status='active' and lower(u.email) like '%.invalid');
$$;

create function public.payment_sandbox_account_set(target_user uuid,enabled boolean,change_reason text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare actor uuid; mail text; had_row boolean; was_active boolean; clean text;
begin
 actor:=private.require_superadmin();
 clean:=trim(coalesce(change_reason,''));
 if target_user is null or enabled is null or length(clean) not between 10 and 1000 then raise exception 'Solicitud inválida' using errcode='22023'; end if;
 -- Serialize per target account BEFORE reading its state: for a first authorization there is no row to lock, so two concurrent calls would both see
 -- "no row" and both record 'authorized'. The lock makes the second one a 'reauthorized' (or a no-op revocation) and keeps the history truthful.
 perform pg_advisory_xact_lock(71301431,hashtext(target_user::text));
 select lower(email) into mail from auth.users where id=target_user;
 if mail is null or not exists(select 1 from public.profiles where id=target_user) then raise exception 'Cuenta inexistente' using errcode='22023'; end if;
 if enabled then
  if mail not like '%.invalid' then raise exception 'Sólo cuentas sintéticas (correo .invalid) pueden usar pagos Sandbox' using errcode='PT409'; end if;
  select true,(revoked_at is null) into had_row,was_active from private.payment_sandbox_accounts where user_id=target_user for update;
  insert into private.payment_sandbox_accounts(user_id,authorized_by,reason)values(target_user,actor,clean)
  on conflict(user_id)do update set authorized_by=excluded.authorized_by,reason=excluded.reason,authorized_at=now(),revoked_at=null,revoked_by=null,revoke_reason=null;
  insert into private.payment_sandbox_account_events(user_id,action,actor_id,reason)values(target_user,case when coalesce(had_row,false) then 'reauthorized' else 'authorized' end,actor,clean);
 else
  update private.payment_sandbox_accounts set revoked_at=now(),revoked_by=actor,revoke_reason=clean where user_id=target_user and revoked_at is null returning true into was_active;
  if coalesce(was_active,false) then insert into private.payment_sandbox_account_events(user_id,action,actor_id,reason)values(target_user,'revoked',actor,clean); end if;
 end if;
 return jsonb_build_object('user_id',target_user,'enabled',private.payment_sandbox_account_allowed(target_user));
end; $$;

-- Backend enforcement: patch the existing functions in place (same technique as the confirm_completion extension).
do $$ declare src text; begin
 -- 1. prepare: the customer must be an authorized synthetic account BEFORE any order/attempt is created.
 select pg_get_functiondef(p.oid) into src from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='payment_prepare';
 if position('Pago exclusivo del cliente' in src)=0 then raise exception 'payment_prepare inesperado'; end if;
 src:=replace(src,'raise exception ''Pago exclusivo del cliente'' using errcode=''42501''; end if;',
  'raise exception ''Pago exclusivo del cliente'' using errcode=''42501''; end if;
 if not private.payment_sandbox_account_allowed(actor) then raise exception ''Pagos Sandbox no habilitados para esta cuenta'' using errcode=''42501''; end if;');
 if position('payment_sandbox_account_allowed' in src)=0 then raise exception 'No se pudo extender payment_prepare'; end if;
 execute src;
 -- 2. reserve (before any external call) and 3. reopen checkout: the owner must still be authorized.
 select pg_get_functiondef(p.oid) into src from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='payment_attempt_begin_create';
 if position('La obligación ya no admite cobro' in src)=0 then raise exception 'begin_create inesperado'; end if;
 src:=replace(src,'
 then raise exception ''La obligación ya no admite cobro''','
  or not private.payment_sandbox_account_allowed(o.customer_id)
 then raise exception ''La obligación ya no admite cobro''');
 if position('payment_sandbox_account_allowed' in src)=0 then raise exception 'No se pudo extender begin_create'; end if;
 execute src;
 select pg_get_functiondef(p.oid) into src from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='payment_attempt_checkout';
 if position('Checkout no disponible' in src)=0 then raise exception 'attempt_checkout inesperado'; end if;
 src:=replace(src,'
 then raise exception ''Checkout no disponible''','
  or not private.payment_sandbox_account_allowed(o.customer_id)
 then raise exception ''Checkout no disponible''');
 if position('payment_sandbox_account_allowed' in src)=0 then raise exception 'No se pudo extender attempt_checkout'; end if;
 execute src;
 -- 4. read model: the UI needs to know whether the viewer may use Sandbox payments (mirror only; the database decides).
 select pg_get_functiondef(p.oid) into src from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='job_payments';
 src:=replace(src,'''payment_state'',j.payment_state,''environment'',''sandbox'',','''payment_state'',j.payment_state,''environment'',''sandbox'',''sandbox_enabled'',(admin or private.payment_sandbox_account_allowed(viewer)),');
 if position('sandbox_enabled' in src)=0 then raise exception 'No se pudo extender job_payments'; end if;
 execute src;
 -- 5. admin overview: who is authorized (read-only for moderators; names only).
 select pg_get_functiondef(p.oid) into src from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='payment_admin_overview';
 src:=replace(src,'''quarantined_inbox'',(select count(*)from private.payment_inbox where state=''quarantined''))',
  '''quarantined_inbox'',(select count(*)from private.payment_inbox where state=''quarantined''),
 ''sandbox_accounts'',coalesce((select jsonb_agg(jsonb_build_object(''user_id'',a.user_id,''name'',pr.full_name,''reason'',a.reason,''authorized_at'',a.authorized_at,''revoked_at'',a.revoked_at,''active'',private.payment_sandbox_account_allowed(a.user_id))order by a.authorized_at desc)
  from private.payment_sandbox_accounts a join public.profiles pr on pr.id=a.user_id),''[]''))');
 if position('sandbox_accounts' in src)=0 then raise exception 'No se pudo extender payment_admin_overview'; end if;
 execute src;
end $$;

revoke all on function private.payment_sandbox_account_events_append_only()from public,anon,authenticated,service_role;
revoke all on function private.payment_sandbox_account_allowed(uuid)from public,anon,authenticated,service_role;
revoke all on function public.payment_sandbox_account_set(uuid,boolean,text)from public,anon,authenticated,service_role;
grant execute on function public.payment_sandbox_account_set(uuid,boolean,text)to authenticated;
