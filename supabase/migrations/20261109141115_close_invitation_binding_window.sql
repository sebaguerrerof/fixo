-- Integration regression: Auth inserts invited identities before setting invited_at.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

create function private.has_unaccepted_invitation(target uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select exists(select 1 from private.user_invitations i join auth.users u
    on (i.user_id=u.id or (i.user_id is null and i.email=lower(u.email)))
    where u.id=target and i.state <> 'accepted');
$$;
revoke all on function private.has_unaccepted_invitation(uuid) from public,anon,authenticated;

create or replace function private.is_active_account()
returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select private.live_session() and exists(select 1 from public.profiles p
    where p.id=(select auth.uid()) and p.account_status='active'
    and not private.has_unaccepted_invitation(p.id));
$$;
create or replace function private.public_technician(target uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select exists(select 1 from public.profiles p join public.technician_profiles t on t.user_id=p.id
    where p.id=target and p.role='technician' and p.account_status='active'
    and t.status in ('verified','active') and not private.has_unaccepted_invitation(p.id));
$$;
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare requested public.app_role := 'customer'; display_name text; invited_identity boolean;
begin
  -- Auth can populate invited_at AFTER INSERT. The private reservation is authoritative.
  invited_identity := new.invited_at is not null or exists(
    select 1 from private.user_invitations where email=lower(new.email) and state='pending');
  -- account_type only selects the non-privileged application path, never an admin role.
  if not invited_identity then
    if new.raw_user_meta_data->>'terms_accepted' is distinct from 'true'
      or char_length(trim(coalesce(new.raw_user_meta_data->>'first_name',''))) not between 1 and 60
      or char_length(trim(coalesce(new.raw_user_meta_data->>'last_name',''))) not between 1 and 60
      or not private.valid_phone(new.raw_user_meta_data->>'phone')
      or char_length(trim(new.raw_user_meta_data->>'first_name')||' '||trim(new.raw_user_meta_data->>'last_name'))>120
    then raise exception 'Datos de registro incompletos' using errcode='22023'; end if;
  end if;
  if not invited_identity and new.raw_user_meta_data->>'account_type'='technician' then requested:='technician'; end if;
  display_name:=case when not invited_identity then trim(new.raw_user_meta_data->>'first_name')||' '||trim(new.raw_user_meta_data->>'last_name') else left(trim(coalesce(new.raw_user_meta_data->>'full_name','')),120) end;
  if char_length(display_name)<2 then display_name:='Cuenta Fixo'; end if;
  insert into public.profiles(id,full_name,role) values(new.id,display_name,requested);
  if invited_identity then
    update private.user_invitations set user_id=new.id where email=lower(new.email) and state='pending' ;
  end if;
  insert into private.account_details(user_id,first_name,last_name,phone,terms_version,consent_at)
  values(new.id,left(coalesce(new.raw_user_meta_data->>'first_name',''),60),left(coalesce(new.raw_user_meta_data->>'last_name',''),60),
    left(coalesce(new.raw_user_meta_data->>'phone',''),24),
    case when new.raw_user_meta_data->>'terms_accepted'='true' then '2026-11-08' end,
    case when new.raw_user_meta_data->>'terms_accepted'='true' then now() end);
  if requested='technician' then perform private.ensure_technician(new.id,new.raw_user_meta_data); end if;
  return new;
end;
$$;

create or replace function public.my_account_access()
returns jsonb language sql stable security definer set search_path=pg_catalog as $$
  select jsonb_build_object('id',p.id,'name',p.full_name,'role',p.role,'account_status',p.account_status,
    'allowed',private.is_active_account(),'invitation_pending',exists(
      select 1 from private.user_invitations i join auth.users u on u.id=p.id
      where (i.user_id=p.id or (i.user_id is null and i.email=lower(u.email)))
        and i.state='pending' and i.expires_at>now()))
  from public.profiles p where p.id=(select auth.uid());
$$;
commit;
