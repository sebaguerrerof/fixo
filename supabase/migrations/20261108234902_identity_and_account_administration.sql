-- Sprint 01. Additive; validate in an isolated instance before remote application.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create type public.account_status as enum ('active', 'suspended', 'blocked');
alter table public.profiles add column account_status public.account_status not null default 'active';
create index profiles_administration_idx on public.profiles(role, account_status, created_at desc, id);

-- Contact, consent, invitations and audit are deliberately outside the Data API.
create table private.account_details (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  first_name text not null default '' check (char_length(first_name) <= 60),
  last_name text not null default '' check (char_length(last_name) <= 60),
  phone text not null default '' check (char_length(phone) <= 24),
  terms_version text, consent_at timestamptz
);
create table private.account_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete restrict,
  target_id uuid references public.profiles(id) on delete restrict,
  action text not null, reason text not null check (char_length(reason) between 3 and 500),
  previous_value jsonb, next_value jsonb,
  result text not null default 'success' check (result in ('success','denied','failed','uncertain')),
  request_id uuid unique, created_at timestamptz not null default now()
);
create index account_events_target_idx on private.account_events(target_id,created_at desc);
create table private.user_invitations (
  id uuid primary key default gen_random_uuid(), email text not null unique,
  full_name text not null check (char_length(full_name) between 2 and 120),
  role public.app_role not null, actor_id uuid not null references public.profiles(id),
  user_id uuid references public.profiles(id),
  state text not null default 'pending' check (state in ('pending','accepted','revoked')),
  delivery text not null default 'sending' check (delivery in ('sending','sent','failed','uncertain')),
  generation integer not null default 1,
  request_id uuid not null unique, last_sent_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '1 hour',
  accepted_at timestamptz, created_at timestamptz not null default now()
);
create index invitations_user_idx on private.user_invitations(user_id);
create table private.auth_flows (
  token_hash text primary key, user_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid not null, kind text not null check(kind in ('recovery','invite')),
  expires_at timestamptz not null default now()+interval '15 minutes'
);
create table private.auth_rate_limits (
  key text primary key, window_start timestamptz not null default now(), attempts integer not null default 1
);
alter table private.account_details enable row level security;
alter table private.account_events enable row level security;
alter table private.user_invitations enable row level security;
alter table private.auth_flows enable row level security;
alter table private.auth_rate_limits enable row level security;
revoke all on all tables in schema private from public, anon, authenticated;

create function private.live_session()
returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id
    where s.user_id=(select auth.uid()) and s.id::text=auth.jwt()->>'session_id'
      and (s.not_after is null or s.not_after>now()) and u.email_confirmed_at is not null);
$$;
create or replace function private.is_active_account()
returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select private.live_session() and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.account_status='active'
    and not exists(select 1 from private.user_invitations i where i.user_id=p.id and i.state <> 'accepted'));
$$;
create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select private.is_active_account() and exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('moderator','superadmin'));
$$;
create or replace function private.public_technician(target uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select exists(select 1 from public.profiles p join public.technician_profiles t on t.user_id=p.id
    where p.id=target and p.role='technician' and p.account_status='active' and t.status in ('verified','active')
    and not exists(select 1 from private.user_invitations i where i.user_id=p.id and i.state <> 'accepted'));
$$;
create or replace function private.active_technician_id()
returns uuid language sql stable security definer set search_path=pg_catalog as $$
  select user_id from public.technician_profiles where user_id=(select auth.uid()) and status='active'
    and private.public_technician(user_id) and private.is_active_account();
$$;

-- Bounds/type checks prevent malformed user metadata from crashing the signup trigger.
create function private.valid_phone(phone_value text)
returns boolean language sql immutable set search_path=pg_catalog as $$
  select coalesce(phone_value ~ '^\+?[0-9 ()-]{8,24}$'
    and char_length(regexp_replace(phone_value,'[^0-9]','','g')) between 8 and 15,false);
$$;
create function private.metadata_array(data jsonb, key_name text)
returns text[] language sql immutable set search_path=pg_catalog as $$
  select coalesce(array(select left(value #>> '{}',100) from jsonb_array_elements(
    case when jsonb_typeof(data->key_name)='array' then data->key_name else '[]'::jsonb end) value
    where jsonb_typeof(value)='string' limit 20),'{}'::text[]);
$$;
create function private.ensure_technician(target uuid, data jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare years_value integer := 0; price_value integer := 0; item text;
begin
  if coalesce(data->>'years_of_experience','') ~ '^\d{1,2}$' then years_value:=least((data->>'years_of_experience')::integer,80); end if;
  if coalesce(data->>'starting_price_clp','') ~ '^\d{1,8}$' then price_value:=least((data->>'starting_price_clp')::integer,10000000); end if;
  insert into public.technician_profiles(user_id,slug,city,coverage_areas,headline,bio,status,years_of_experience,starting_price_clp,submitted_at)
  values(target,'tecnico-'||replace(target::text,'-',''),
    case when char_length(trim(coalesce(data->>'city',''))) between 2 and 80 then trim(data->>'city') else 'Santiago' end,
    private.metadata_array(data,'coverage_areas'),left(coalesce(data->>'headline',''),180),left(coalesce(data->>'bio',''),2000),
    'pending_verification',years_value,price_value,now()) on conflict(user_id) do nothing;
  foreach item in array private.metadata_array(data,'category_ids') loop
    insert into public.technician_categories(technician_id,category_id) select target,id from public.categories where id=item on conflict do nothing;
  end loop;
  foreach item in array private.metadata_array(data,'specialties') loop
    if char_length(trim(item)) between 2 and 100 then insert into public.technician_specialties(technician_id,name) values(target,trim(item)) on conflict do nothing; end if;
  end loop;
  insert into public.technician_metrics(technician_id) values(target) on conflict do nothing;
end;
$$;
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare requested public.app_role := 'customer'; display_name text;
begin
  -- account_type only selects the non-privileged application path, never an admin role.
  if new.invited_at is null then
    if new.raw_user_meta_data->>'terms_accepted' is distinct from 'true'
      or char_length(trim(coalesce(new.raw_user_meta_data->>'first_name',''))) not between 1 and 60
      or char_length(trim(coalesce(new.raw_user_meta_data->>'last_name',''))) not between 1 and 60
      or not private.valid_phone(new.raw_user_meta_data->>'phone')
      or char_length(trim(new.raw_user_meta_data->>'first_name')||' '||trim(new.raw_user_meta_data->>'last_name'))>120
    then raise exception 'Datos de registro incompletos' using errcode='22023'; end if;
  end if;
  if new.invited_at is null and new.raw_user_meta_data->>'account_type'='technician' then requested:='technician'; end if;
  display_name:=case when new.invited_at is null then trim(new.raw_user_meta_data->>'first_name')||' '||trim(new.raw_user_meta_data->>'last_name') else left(trim(coalesce(new.raw_user_meta_data->>'full_name','')),120) end;
  if char_length(display_name)<2 then display_name:='Cuenta Fixo'; end if;
  insert into public.profiles(id,full_name,role) values(new.id,display_name,requested);
  if new.invited_at is not null then
    update private.user_invitations set user_id=new.id where email=lower(new.email) and state='pending' and delivery='sending';
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
insert into private.account_details(user_id) select id from public.profiles on conflict do nothing;

create function public.my_account_access()
returns jsonb language sql stable security definer set search_path=pg_catalog as $$
  select jsonb_build_object('id',p.id,'name',p.full_name,'role',p.role,'account_status',p.account_status,
    'allowed',private.is_active_account(),'invitation_pending',exists(select 1 from private.user_invitations i where i.user_id=p.id and i.state='pending' and i.expires_at>now()))
  from public.profiles p where p.id=(select auth.uid());
$$;
create function public.my_profile()
returns jsonb language sql stable security definer set search_path=pg_catalog as $$
  select jsonb_build_object('firstName',d.first_name,'lastName',d.last_name,'phone',d.phone,'email',u.email,'fullName',p.full_name,
    'role',p.role,'accountStatus',p.account_status,'createdAt',p.created_at,'termsAccepted',d.consent_at is not null,
    'technician',case when t.user_id is null then null else jsonb_build_object('city',t.city,'headline',t.headline,'bio',t.bio,
      'coverageAreas',array_to_string(t.coverage_areas,', '),'status',t.status,
      'categoryIds',(select coalesce(jsonb_agg(category_id),'[]') from public.technician_categories where technician_id=p.id)) end)
  from public.profiles p join auth.users u on u.id=p.id join private.account_details d on d.user_id=p.id
  left join public.technician_profiles t on t.user_id=p.id where p.id=(select auth.uid()) and private.is_active_account();
$$;
create function public.update_my_profile(first_name text,last_name text,phone_number text,professional jsonb default null)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare current_role public.app_role; current_state public.technician_status; item text;
begin
  if not private.is_active_account() then raise exception 'Cuenta no habilitada' using errcode='42501'; end if;
  if char_length(trim(first_name)||' '||trim(last_name))>120 or char_length(trim(first_name)) not between 1 and 60 or char_length(trim(last_name)) not between 1 and 60 or not private.valid_phone(phone_number) then raise exception 'Datos inválidos' using errcode='22023'; end if;
  select role into current_role from public.profiles where id=auth.uid() for update;
  update public.profiles set full_name=trim(first_name)||' '||trim(last_name) where id=auth.uid();
  update private.account_details set first_name=trim(update_my_profile.first_name),last_name=trim(update_my_profile.last_name),phone=phone_number where user_id=auth.uid();
  if professional is not null then
    select status into current_state from public.technician_profiles where user_id=auth.uid() for update;
    if current_role<>'technician' or current_state not in ('draft','pending_verification','needs_information') or current_state is null then raise exception 'Postulación no editable' using errcode='42501'; end if;
    if char_length(trim(coalesce(professional->>'city',''))) not between 2 and 80
      or char_length(coalesce(professional->>'headline',''))>180 or char_length(coalesce(professional->>'bio',''))>2000
      or jsonb_typeof(professional->'category_ids') is distinct from 'array' or jsonb_array_length(professional->'category_ids') not between 1 and 8 then raise exception 'Datos inválidos' using errcode='22023'; end if;
    update public.technician_profiles set city=trim(professional->>'city'),headline=coalesce(professional->>'headline',''),bio=coalesce(professional->>'bio',''),
      coverage_areas=private.metadata_array(professional,'coverage_areas') where user_id=auth.uid();
    delete from public.technician_categories where technician_id=auth.uid();
    foreach item in array private.metadata_array(professional,'category_ids') loop
      if not exists(select 1 from public.categories where id=item) then raise exception 'Rubro inválido' using errcode='22023'; end if;
      insert into public.technician_categories values(auth.uid(),item) on conflict do nothing;
    end loop;
  end if;
end;
$$;

create function private.require_administrator()
returns public.app_role language plpgsql stable security definer set search_path=pg_catalog as $$
declare actor_role public.app_role;
begin
  if not private.is_admin() then raise exception 'Operación no autorizada' using errcode='42501'; end if;
  select role into actor_role from public.profiles where id=auth.uid();
  return actor_role;
end;
$$;
create function public.admin_list_users(search_text text default '',role_filter public.app_role default null,status_filter public.account_status default null,page_number integer default 1)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare result jsonb; search_value text:=left(trim(coalesce(search_text,'')),120);
begin
  perform private.require_administrator();
  if page_number not between 1 and 10000 then raise exception 'Página inválida' using errcode='22023'; end if;
  select jsonb_build_object('total',count(*),'page',page_number,'pageSize',20) into result from public.profiles p join auth.users u on u.id=p.id
  where (role_filter is null or p.role=role_filter) and (status_filter is null or p.account_status=status_filter)
    and (search_value='' or position(lower(search_value) in lower(p.full_name||' '||coalesce(u.email,'')))>0);
  return result||jsonb_build_object('users',coalesce((select jsonb_agg(row_to_json(rows)) from (
    select p.id,p.full_name,p.role,p.account_status,p.created_at,u.email,u.last_sign_in_at
    from public.profiles p join auth.users u on u.id=p.id
    where (role_filter is null or p.role=role_filter) and (status_filter is null or p.account_status=status_filter)
      and (search_value='' or position(lower(search_value) in lower(p.full_name||' '||coalesce(u.email,'')))>0)
    order by p.created_at desc,p.id limit 20 offset (page_number-1)*20) rows),'[]'::jsonb));
end;
$$;
create function public.admin_user_detail(target_user uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare actor_role public.app_role; result jsonb;
begin
  actor_role:=private.require_administrator();
  select jsonb_build_object('id',p.id,'full_name',p.full_name,'role',p.role,'account_status',p.account_status,
    'created_at',p.created_at,'email',u.email,'last_sign_in_at',u.last_sign_in_at,'phone',d.phone,'technician_status',t.status)
  into result from public.profiles p join auth.users u on u.id=p.id left join private.account_details d on d.user_id=p.id
  left join public.technician_profiles t on t.user_id=p.id where p.id=target_user;
  return result||jsonb_build_object('history',coalesce((select jsonb_agg(row_to_json(rows)) from (
    select e.id,e.actor_id,e.action,e.reason,e.previous_value,e.next_value,e.result,e.created_at
    from private.account_events e where e.target_id=target_user and (actor_role='superadmin' or (
      e.action in ('account_status_changed','account_change','invitation_reserved','invitation_sent','invitation_revoked','invitation_revoke','invitation_accepted','observation')
      and coalesce(e.previous_value->>'role','customer') not in ('moderator','superadmin')
      and coalesce(e.next_value->>'role','customer') not in ('moderator','superadmin')))
    order by e.created_at desc,e.id limit 100) rows),'[]'::jsonb));
end;
$$;
create function public.admin_change_account(target_user uuid,new_status public.account_status,new_role public.app_role,change_reason text,operation_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare actor_role public.app_role; target public.profiles; effective_role public.app_role; effective_status public.account_status; prior private.account_events;
begin
  -- One transaction lock serializes privilege/state changes, including last-superadmin checks.
  perform pg_advisory_xact_lock(71301421);
  actor_role:=private.require_administrator();
  if operation_id is null or char_length(trim(coalesce(change_reason,''))) not between 3 and 500 or (new_role is null and new_status is null) then raise exception 'Datos inválidos' using errcode='22023'; end if;
  select * into prior from private.account_events where request_id=operation_id;
  if found then
    if prior.actor_id is distinct from auth.uid() or prior.target_id is distinct from target_user or prior.next_value->>'requested_role' is distinct from new_role::text or prior.next_value->>'requested_status' is distinct from new_status::text then raise exception 'Reintento incompatible' using errcode='22023'; end if;
    return prior.next_value;
  end if;
  select * into target from public.profiles where id=target_user for update;
  if not found then raise exception 'Cuenta no disponible' using errcode='P0002'; end if;
  if target.id=auth.uid() then raise exception 'No puedes cambiar tu propio acceso' using errcode='42501'; end if;
  if actor_role<>'superadmin' and (new_role is not null or target.role in ('moderator','superadmin')) then raise exception 'Operación no autorizada' using errcode='42501'; end if;
  effective_role:=coalesce(new_role,target.role); effective_status:=coalesce(new_status,target.account_status);
  if target.role='superadmin' and target.account_status='active' and (effective_role<>'superadmin' or effective_status<>'active')
    and (select count(*) from public.profiles where role='superadmin' and account_status='active')<=1 then raise exception 'Debe permanecer un superadministrador activo' using errcode='23514'; end if;
  if effective_role='technician' and target.role<>'technician' then
    perform private.ensure_technician(target_user);
    update public.technician_profiles set status='pending_verification',verified_at=null,submitted_at=now() where user_id=target_user;
  end if;
  update public.profiles set role=effective_role,account_status=effective_status where id=target_user;
  insert into private.account_events(actor_id,target_id,action,reason,previous_value,next_value,request_id)
  values(auth.uid(),target_user,case when new_role is not null then 'role_changed' else 'account_status_changed' end,trim(change_reason),
    jsonb_build_object('role',target.role,'status',target.account_status),
    jsonb_build_object('role',effective_role,'status',effective_status,'requested_role',new_role,'requested_status',new_status),operation_id);
  return jsonb_build_object('role',effective_role,'status',effective_status,'requested_role',new_role,'requested_status',new_status);
end;
$$;
create function public.admin_observe_user(target_user uuid,observation text,operation_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare actor_role public.app_role;
begin
  actor_role:=private.require_administrator();
  if not exists(select 1 from public.profiles where id=target_user and (actor_role='superadmin' or role in ('customer','technician'))) then raise exception 'Operación no autorizada' using errcode='42501'; end if;
  if char_length(trim(coalesce(observation,''))) not between 3 and 500 then raise exception 'Motivo requerido' using errcode='22023'; end if;
  insert into private.account_events(actor_id,target_id,action,reason,request_id) values(auth.uid(),target_user,'observation',trim(observation),operation_id) on conflict(request_id) do nothing;
end;
$$;

-- Durable reservation before Auth's external side effect. Uncertain attempts are never silently retried.
create function public.admin_reserve_invitation(invite_email text,invite_name text,invite_role public.app_role,operation_id uuid,resend boolean default false)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare actor_role public.app_role; inv private.user_invitations; normalized text:=lower(trim(invite_email));
begin
  perform pg_advisory_xact_lock(71301421);
  actor_role:=private.require_administrator();
  if invite_role is null or (actor_role<>'superadmin' and invite_role in ('moderator','superadmin')) then raise exception 'Operación no autorizada' using errcode='42501'; end if;
  if normalized is null or normalized !~ '^[^ @]+@[^ @]+\.[^ @]+$' or char_length(normalized)>254 or char_length(trim(coalesce(invite_name,''))) not between 2 and 120 or operation_id is null then raise exception 'Datos inválidos' using errcode='22023'; end if;
  select * into inv from private.user_invitations where request_id=operation_id;
  if found then
    if inv.actor_id<>auth.uid() or inv.email<>normalized or inv.role<>invite_role then raise exception 'Reintento incompatible' using errcode='22023'; end if;
    return jsonb_build_object('id',inv.id,'send',false,'delivery',inv.delivery,'generation',inv.generation);
  end if;
  if (select count(*) from private.account_events where actor_id=auth.uid() and action='invitation_reserved' and created_at>now()-interval '1 hour')>=10 then raise exception 'Límite de invitaciones' using errcode='P0001'; end if;
  select * into inv from private.user_invitations where email=normalized for update;
  if found then
    if inv.role<>invite_role or inv.state<>'pending' or not resend then return jsonb_build_object('id',inv.id,'send',false,'delivery',inv.delivery,'generation',inv.generation); end if;
    if actor_role<>'superadmin' and inv.actor_id<>auth.uid() then raise exception 'Operación no autorizada' using errcode='42501'; end if;
    if inv.last_sent_at>now()-interval '60 seconds' then raise exception 'Espera antes de reenviar' using errcode='P0001'; end if;
    update private.user_invitations set generation=generation+1,actor_id=auth.uid(),request_id=operation_id,delivery='sending',last_sent_at=now(),expires_at=now()+interval '1 hour' where id=inv.id returning * into inv;
  else
    if exists(select 1 from auth.users where lower(email)=normalized) then raise exception 'Ya existe una cuenta; utiliza su ficha' using errcode='23505'; end if;
    insert into private.user_invitations(email,full_name,role,actor_id,request_id) values(normalized,trim(invite_name),invite_role,auth.uid(),operation_id) returning * into inv;
  end if;
  insert into private.account_events(actor_id,action,reason,next_value) values(auth.uid(),'invitation_reserved','Invitación administrativa solicitada',jsonb_build_object('invitation_id',inv.id,'role',inv.role));
  return jsonb_build_object('id',inv.id,'send',true,'generation',inv.generation,'email',inv.email,'fullName',inv.full_name,'userId',inv.user_id);
end;
$$;
create function public.finish_invitation_delivery(invitation_id uuid,delivery_generation integer,invited_user uuid,delivery_result text)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare inv private.user_invitations;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Operación no autorizada' using errcode='42501'; end if;
  if delivery_result not in ('sent','failed','uncertain') then raise exception 'Resultado inválido' using errcode='22023'; end if;
  select * into inv from private.user_invitations where id=invitation_id and generation=delivery_generation for update;
  if not found or inv.state<>'pending' then raise exception 'Invitación no disponible' using errcode='22023'; end if;
  if invited_user is not null and not exists(select 1 from auth.users where id=invited_user and lower(email)=inv.email and invited_at is not null) then raise exception 'Identidad incompatible' using errcode='22023'; end if;
  update private.user_invitations set user_id=coalesce(invited_user,user_id),delivery=delivery_result where id=inv.id;
  insert into private.account_events(actor_id,target_id,action,reason,next_value,result)
  values(inv.actor_id,invited_user,'invitation_sent','Resultado del proveedor Auth',jsonb_build_object('invitation_id',inv.id,'role',inv.role,'delivery',delivery_result),case when delivery_result='sent' then 'success' when delivery_result='uncertain' then 'uncertain' else 'failed' end);
end;
$$;
create function public.admin_list_invitations()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare actor_role public.app_role;
begin
  actor_role:=private.require_administrator();
  return coalesce((select jsonb_agg(row_to_json(rows)) from (
    select id,email,full_name,role,delivery,case when state='pending' and expires_at<=now() then 'expired' else state end as state,expires_at,created_at
    from private.user_invitations where actor_role='superadmin' or (actor_id=auth.uid() and role in ('customer','technician')) order by created_at desc limit 100) rows),'[]'::jsonb);
end;
$$;
create function public.admin_revoke_invitation(invitation_id uuid,change_reason text)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare actor_role public.app_role; inv private.user_invitations;
begin
  perform pg_advisory_xact_lock(71301421); actor_role:=private.require_administrator();
  if char_length(trim(coalesce(change_reason,''))) not between 3 and 500 then raise exception 'Motivo requerido' using errcode='22023'; end if;
  select * into inv from private.user_invitations where id=invitation_id for update;
  if not found or (actor_role<>'superadmin' and (inv.actor_id<>auth.uid() or inv.role in ('moderator','superadmin'))) then raise exception 'Operación no autorizada' using errcode='42501'; end if;
  if inv.state<>'pending' then raise exception 'Invitación no pendiente' using errcode='22023'; end if;
  update private.user_invitations set state='revoked' where id=inv.id;
  insert into private.account_events(actor_id,target_id,action,reason,next_value) values(auth.uid(),inv.user_id,'invitation_revoked',trim(change_reason),jsonb_build_object('invitation_id',inv.id,'role',inv.role));
end;
$$;
create function public.accept_my_invitation(first_name text,last_name text,phone_number text,terms_accepted boolean)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare inv private.user_invitations; actor public.profiles;
begin
  perform pg_advisory_xact_lock(71301421);
  if not private.live_session() then raise exception 'Sesión no válida' using errcode='42501'; end if;
  select * into inv from private.user_invitations where user_id=auth.uid() for update;
  if not found or inv.state<>'pending' or inv.expires_at<=now() or not exists(select 1 from auth.users where id=auth.uid() and lower(email)=inv.email and email_confirmed_at is not null and invited_at is not null) then raise exception 'Invitación no disponible' using errcode='42501'; end if;
  select * into actor from public.profiles where id=inv.actor_id;
  if actor.account_status<>'active' or actor.role not in ('moderator','superadmin') or (inv.role in ('moderator','superadmin') and actor.role<>'superadmin') then raise exception 'Invitación no autorizada' using errcode='42501'; end if;
  if char_length(trim(first_name)||' '||trim(last_name))>120 or not terms_accepted or terms_accepted is null or char_length(trim(coalesce(first_name,''))) not between 1 and 60 or char_length(trim(coalesce(last_name,''))) not between 1 and 60 or not private.valid_phone(phone_number) then raise exception 'Datos inválidos' using errcode='22023'; end if;
  if inv.role='technician' then perform private.ensure_technician(auth.uid()); end if;
  update public.profiles set role=inv.role,full_name=trim(first_name)||' '||trim(last_name) where id=auth.uid() and account_status='active';
  if not found then raise exception 'Cuenta no habilitada' using errcode='42501'; end if;
  update private.account_details set first_name=trim(accept_my_invitation.first_name),last_name=trim(accept_my_invitation.last_name),phone=phone_number,terms_version='2026-11-08',consent_at=now() where user_id=auth.uid();
  update private.user_invitations set state='accepted',accepted_at=now() where id=inv.id;
  insert into private.account_events(actor_id,target_id,action,reason,next_value) values(auth.uid(),auth.uid(),'invitation_accepted','Identidad confirmada y perfil completado',jsonb_build_object('role',inv.role,'invitation_id',inv.id));
end;
$$;

create function public.issue_auth_flow(flow_hash text,target_user uuid,target_session uuid,flow_kind text)
returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Operación no autorizada' using errcode='42501'; end if;
  delete from private.auth_flows where user_id=target_user or expires_at<now();
  insert into private.auth_flows(token_hash,user_id,session_id,kind) values(flow_hash,target_user,target_session,flow_kind);
end;
$$;
create function public.check_auth_flow(flow_hash text,consume boolean default false)
returns text language plpgsql security definer set search_path=pg_catalog as $$
declare result text;
begin
  select kind into result from private.auth_flows where token_hash=flow_hash and user_id=auth.uid()
    and session_id::text=auth.jwt()->>'session_id' and expires_at>now() and private.live_session() for update;
  if result is null then raise exception 'Enlace no válido o expirado' using errcode='42501'; end if;
  if consume then delete from private.auth_flows where token_hash=flow_hash; end if;
  return result;
end;
$$;
create function public.admin_account_audit(target_user uuid default null,page_number integer default 1)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare actor_role public.app_role; result jsonb;
begin
  actor_role:=private.require_administrator();
  if page_number not between 1 and 10000 then raise exception 'Página inválida' using errcode='22023'; end if;
  with visible as (
    select e.* from private.account_events e where (target_user is null or e.target_id=target_user)
    and (actor_role='superadmin' or (e.action<>'role_changed'
      and coalesce(e.previous_value->>'role','customer') not in ('moderator','superadmin')
      and coalesce(e.next_value->>'role','customer') not in ('moderator','superadmin')))
  ) select jsonb_build_object('total',(select count(*) from visible),'page',page_number,
    'events',coalesce((select jsonb_agg(row_to_json(rows)) from (
      select id,actor_id,target_id,action,reason,previous_value,next_value,result,created_at from visible
      order by created_at desc,id limit 20 offset (page_number-1)*20) rows),'[]'::jsonb)) into result;
  return result;
end;
$$;
revoke all on function public.admin_account_audit(uuid,integer) from public,anon;
grant execute on function public.admin_account_audit(uuid,integer) to authenticated;

create function public.record_account_action_failure(target_user uuid,attempted_action text,change_reason text,failure_result text)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare target_role public.app_role;
begin
  perform private.require_administrator();
  if attempted_action not in ('account_change','invitation','observation','invitation_revoke') or failure_result not in ('denied','failed','uncertain')
    or char_length(trim(coalesce(change_reason,''))) not between 3 and 500 then raise exception 'Datos inválidos' using errcode='22023'; end if;
  if (select count(*) from private.account_events where actor_id=auth.uid() and result<>'success' and created_at>now()-interval '1 hour')>=100 then return; end if;
  select role into target_role from public.profiles where id=target_user;
  insert into private.account_events(actor_id,target_id,action,reason,next_value,result)
  values(auth.uid(),target_user,attempted_action,trim(change_reason),jsonb_build_object('role',target_role),failure_result);
end;
$$;
revoke all on function public.record_account_action_failure(uuid,text,text,text) from public,anon;
grant execute on function public.record_account_action_failure(uuid,text,text,text) to authenticated;

create function public.consume_auth_rate_limit(rate_key text,max_attempts integer default 5)
returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare hits integer;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Operación no autorizada' using errcode='42501'; end if;
  if max_attempts not between 1 and 30 or char_length(rate_key)>100 then raise exception 'Límite inválido' using errcode='22023'; end if;
  delete from private.auth_rate_limits where window_start<now()-interval '1 day';
  insert into private.auth_rate_limits(key) values(rate_key) on conflict(key) do update
  set attempts=case when private.auth_rate_limits.window_start<now()-interval '15 minutes' then 1 else private.auth_rate_limits.attempts+1 end,
      window_start=case when private.auth_rate_limits.window_start<now()-interval '15 minutes' then now() else private.auth_rate_limits.window_start end returning attempts into hits;
  return hits<=max_attempts;
end;
$$;

-- No PII is added to public profiles. Visibility is account AND professional approval.
alter policy "Public profiles are visible for public technicians" on public.profiles using (id=(select auth.uid()) or (select private.is_admin()) or private.public_technician(id));
alter policy "Public technicians are visible and private profiles remain scoped" on public.technician_profiles using (private.public_technician(user_id) or (user_id=(select auth.uid()) and (select private.is_active_account())) or (select private.is_admin()));
alter policy "Technician categories follow profile visibility" on public.technician_categories using (private.public_technician(technician_id) or (technician_id=(select auth.uid()) and (select private.is_active_account())) or (select private.is_admin()));
alter policy "Technician specialties follow profile visibility" on public.technician_specialties using (private.public_technician(technician_id) or (technician_id=(select auth.uid()) and (select private.is_active_account())) or (select private.is_admin()));
alter policy "Technician metrics follow profile visibility" on public.technician_metrics using (private.public_technician(technician_id) or (technician_id=(select auth.uid()) and (select private.is_active_account())) or (select private.is_admin()));
create policy "Active accounts required for requests" on public.service_requests as restrictive for all to authenticated using ((select private.is_active_account())) with check ((select private.is_active_account()));
create policy "Active accounts required for documents" on public.technician_documents as restrictive for all to authenticated using ((select private.is_active_account())) with check ((select private.is_active_account()));
create policy "Active administrators required for legacy audit" on public.admin_audit_entries as restrictive for select to authenticated using ((select private.is_admin()));
-- Scope the restriction to this bucket so other application buckets retain their policies.
create policy "Active accounts required for verification storage" on storage.objects as restrictive for all to authenticated
  using (bucket_id<>'technician-documents' or (select private.is_active_account())) with check (bucket_id<>'technician-documents' or (select private.is_active_account()));

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_active_account(),private.is_admin(),private.active_technician_id(),private.public_technician(uuid) to anon,authenticated;
revoke all on function public.my_account_access(),public.my_profile(),public.update_my_profile(text,text,text,jsonb),
  public.admin_list_users(text,public.app_role,public.account_status,integer),public.admin_user_detail(uuid),
  public.admin_change_account(uuid,public.account_status,public.app_role,text,uuid),public.admin_observe_user(uuid,text,uuid),
  public.admin_reserve_invitation(text,text,public.app_role,uuid,boolean),public.finish_invitation_delivery(uuid,integer,uuid,text),
  public.admin_list_invitations(),public.admin_revoke_invitation(uuid,text),public.accept_my_invitation(text,text,text,boolean),
  public.issue_auth_flow(text,uuid,uuid,text),public.check_auth_flow(text,boolean),public.consume_auth_rate_limit(text,integer)
  from public,anon,authenticated;
grant execute on function public.my_account_access(),public.my_profile(),public.update_my_profile(text,text,text,jsonb),
  public.admin_list_users(text,public.app_role,public.account_status,integer),public.admin_user_detail(uuid),
  public.admin_change_account(uuid,public.account_status,public.app_role,text,uuid),public.admin_observe_user(uuid,text,uuid),
  public.admin_reserve_invitation(text,text,public.app_role,uuid,boolean),public.admin_list_invitations(),
  public.admin_revoke_invitation(uuid,text),public.accept_my_invitation(text,text,text,boolean),public.check_auth_flow(text,boolean) to authenticated;
grant execute on function public.issue_auth_flow(text,uuid,uuid,text),public.finish_invitation_delivery(uuid,integer,uuid,text),public.consume_auth_rate_limit(text,integer) to service_role;
create or replace function public.change_technician_status(
  target_technician_id uuid,
  next_status public.technician_status,
  change_reason text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  current_status public.technician_status;
  updated_profile public.technician_profiles;
begin
  if not private.is_admin() then
    raise exception 'No tienes permiso para gestionar técnicos.' using errcode = '42501';
  end if;

  select status into current_status from public.technician_profiles where user_id = target_technician_id and exists (select 1 from public.profiles where id=target_technician_id and role='technician') for update;
  if current_status is null then
    raise exception 'No existe el perfil técnico.' using errcode = 'P0002';
  end if;

  if not public.technician_status_transition_allowed(current_status, next_status) then
    raise exception 'La transición de estado no está permitida.' using errcode = '22023';
  end if;

  update public.technician_profiles
  set status = next_status,
      verified_at = case when next_status in ('verified', 'active') then now() else verified_at end
  where user_id = target_technician_id
  returning * into updated_profile;

  insert into public.admin_audit_entries (actor_id, technician_id, action, previous_status, next_status, reason)
  values (auth.uid(), target_technician_id, 'technician_status_changed', current_status, next_status, coalesce(nullif(trim(change_reason), ''), 'Cambio de estado desde administración.'));

  return jsonb_build_object('technician_id', updated_profile.user_id, 'status', updated_profile.status);
end;
$$;
alter function public.touch_updated_at() set search_path=pg_catalog;
notify pgrst,'reload schema';
commit;
