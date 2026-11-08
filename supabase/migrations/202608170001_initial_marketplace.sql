create extension if not exists pgcrypto;

create type public.app_role as enum ('customer', 'technician', 'moderator', 'superadmin');
create type public.technician_status as enum (
  'draft', 'pending_verification', 'needs_information', 'verified', 'active',
  'temporarily_suspended', 'suspended', 'banned', 'rejected'
);
create type public.service_request_status as enum (
  'draft', 'submitted', 'matching', 'receiving_quotes', 'technician_selected',
  'awaiting_payment', 'scheduled', 'in_progress', 'completed', 'cancelled', 'expired', 'disputed'
);
create type public.service_priority as enum ('standard', 'urgent');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  role public.app_role not null default 'customer',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  description text not null,
  icon text not null check (icon in ('bolt', 'droplets', 'key-round', 'snowflake', 'monitor-cog', 'wrench', 'paint-roller', 'sprout')),
  created_at timestamptz not null default now()
);

create table public.technician_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  city text not null default 'Santiago' check (char_length(trim(city)) between 2 and 80),
  coverage_areas text[] not null default '{}',
  headline text not null default '' check (char_length(headline) <= 180),
  bio text not null default '' check (char_length(bio) <= 2000),
  status public.technician_status not null default 'draft',
  years_of_experience integer not null default 0 check (years_of_experience between 0 and 80),
  emergency_enabled boolean not null default false,
  starting_price_clp integer not null default 0 check (starting_price_clp >= 0),
  submitted_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.technician_categories (
  technician_id uuid not null references public.technician_profiles(user_id) on delete cascade,
  category_id text not null references public.categories(id) on delete restrict,
  primary key (technician_id, category_id)
);

create table public.technician_specialties (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.technician_profiles(user_id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 100),
  unique (technician_id, name)
);

create table public.technician_metrics (
  technician_id uuid primary key references public.technician_profiles(user_id) on delete cascade,
  rating numeric(2, 1) not null default 0 check (rating between 0 and 5),
  review_count integer not null default 0 check (review_count >= 0),
  completed_jobs integer not null default 0 check (completed_jobs >= 0),
  response_time_minutes integer not null default 0 check (response_time_minutes >= 0),
  completion_rate integer not null default 0 check (completion_rate between 0 and 100),
  updated_at timestamptz not null default now()
);

create table public.technician_documents (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.technician_profiles(user_id) on delete cascade,
  document_type text not null check (document_type in ('identity', 'certificate', 'license', 'other')),
  storage_path text not null unique,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null
);

create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  assigned_technician_id uuid references public.technician_profiles(user_id) on delete set null,
  category_id text not null references public.categories(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 5 and 160),
  description text not null default '' check (char_length(description) <= 3000),
  priority public.service_priority not null default 'standard',
  status public.service_request_status not null default 'submitted',
  location_label text not null check (char_length(trim(location_label)) between 2 and 180),
  scheduled_for timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_audit_entries (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  technician_id uuid not null references public.technician_profiles(user_id) on delete restrict,
  action text not null check (action = 'technician_status_changed'),
  previous_status public.technician_status not null,
  next_status public.technician_status not null,
  reason text not null default '',
  created_at timestamptz not null default now()
);

create index technician_profiles_public_directory_idx on public.technician_profiles(status, city);
create index service_requests_customer_idx on public.service_requests(customer_id, created_at desc);
create index admin_audit_entries_technician_idx on public.admin_audit_entries(technician_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at before update on public.profiles
for each row execute procedure public.touch_updated_at();
create trigger technician_profiles_touch_updated_at before update on public.technician_profiles
for each row execute procedure public.touch_updated_at();
create trigger service_requests_touch_updated_at before update on public.service_requests
for each row execute procedure public.touch_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('moderator', 'superadmin')
  );
$$;

create or replace function public.active_technician_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select user_id from public.technician_profiles
  where user_id = auth.uid() and status = 'active'
  limit 1;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role public.app_role := case when new.raw_user_meta_data ->> 'account_type' = 'technician' then 'technician' else 'customer' end;
  technician_slug text;
  category_id_value text;
  specialty_value text;
  years_value integer := case when coalesce(new.raw_user_meta_data ->> 'years_of_experience', '') ~ '^\d+$' then least((new.raw_user_meta_data ->> 'years_of_experience')::integer, 80) else 0 end;
  price_value integer := case when coalesce(new.raw_user_meta_data ->> 'starting_price_clp', '') ~ '^\d+$' then greatest((new.raw_user_meta_data ->> 'starting_price_clp')::integer, 0) else 0 end;
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    requested_role
  );

  if requested_role = 'technician' then
    technician_slug := trim(both '-' from regexp_replace(lower(coalesce(new.raw_user_meta_data ->> 'full_name', 'tecnico')), '[^a-z0-9]+', '-', 'g')) || '-' || left(new.id::text, 8);

    insert into public.technician_profiles (
      user_id, slug, city, coverage_areas, headline, bio, status,
      years_of_experience, emergency_enabled, starting_price_clp, submitted_at
    ) values (
      new.id,
      technician_slug,
      coalesce(nullif(trim(new.raw_user_meta_data ->> 'city'), ''), 'Santiago'),
      coalesce(array(select jsonb_array_elements_text(coalesce(new.raw_user_meta_data -> 'coverage_areas', '[]'::jsonb))), '{}'),
      coalesce(left(new.raw_user_meta_data ->> 'headline', 180), ''),
      coalesce(left(new.raw_user_meta_data ->> 'bio', 2000), ''),
      'pending_verification',
      years_value,
      coalesce((new.raw_user_meta_data ->> 'emergency_enabled')::boolean, false),
      price_value,
      now()
    );

    for category_id_value in select jsonb_array_elements_text(coalesce(new.raw_user_meta_data -> 'category_ids', '[]'::jsonb)) loop
      insert into public.technician_categories (technician_id, category_id)
      select new.id, category_id_value where exists (select 1 from public.categories where id = category_id_value)
      on conflict do nothing;
    end loop;

    for specialty_value in select jsonb_array_elements_text(coalesce(new.raw_user_meta_data -> 'specialties', '[]'::jsonb)) loop
      if char_length(trim(specialty_value)) between 2 and 100 then
        insert into public.technician_specialties (technician_id, name) values (new.id, trim(specialty_value)) on conflict do nothing;
      end if;
    end loop;

    insert into public.technician_metrics (technician_id) values (new.id);
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Keep accounts created in Auth before this migration usable in the platform.
insert into public.profiles (id, full_name, role)
select
  users.id,
  coalesce(nullif(trim(users.raw_user_meta_data ->> 'full_name'), ''), split_part(users.email, '@', 1), 'Cuenta Fixo'),
  'customer'
from auth.users as users
on conflict (id) do nothing;

create or replace function public.technician_status_transition_allowed(
  current_status public.technician_status,
  next_status public.technician_status
)
returns boolean
language sql
immutable
as $$
  select (current_status, next_status) in (
    ('draft'::public.technician_status, 'pending_verification'::public.technician_status),
    ('draft'::public.technician_status, 'rejected'::public.technician_status),
    ('pending_verification'::public.technician_status, 'needs_information'::public.technician_status),
    ('pending_verification'::public.technician_status, 'verified'::public.technician_status),
    ('pending_verification'::public.technician_status, 'rejected'::public.technician_status),
    ('needs_information'::public.technician_status, 'pending_verification'::public.technician_status),
    ('needs_information'::public.technician_status, 'rejected'::public.technician_status),
    ('verified'::public.technician_status, 'active'::public.technician_status),
    ('verified'::public.technician_status, 'temporarily_suspended'::public.technician_status),
    ('verified'::public.technician_status, 'banned'::public.technician_status),
    ('active'::public.technician_status, 'temporarily_suspended'::public.technician_status),
    ('active'::public.technician_status, 'suspended'::public.technician_status),
    ('active'::public.technician_status, 'banned'::public.technician_status),
    ('temporarily_suspended'::public.technician_status, 'active'::public.technician_status),
    ('temporarily_suspended'::public.technician_status, 'suspended'::public.technician_status),
    ('temporarily_suspended'::public.technician_status, 'banned'::public.technician_status),
    ('suspended'::public.technician_status, 'active'::public.technician_status),
    ('suspended'::public.technician_status, 'banned'::public.technician_status),
    ('rejected'::public.technician_status, 'pending_verification'::public.technician_status)
  );
$$;

create or replace function public.change_technician_status(
  target_technician_id uuid,
  next_status public.technician_status,
  change_reason text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status public.technician_status;
  updated_profile public.technician_profiles;
begin
  if not public.is_admin() then
    raise exception 'No tienes permiso para gestionar técnicos.' using errcode = '42501';
  end if;

  select status into current_status from public.technician_profiles where user_id = target_technician_id for update;
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

insert into public.categories (id, slug, name, description, icon) values
  ('electricidad', 'electricidad', 'Electricidad', 'Instalaciones, tableros y emergencias eléctricas.', 'bolt'),
  ('gasfiteria', 'gasfiteria', 'Gasfitería', 'Fugas, cañerías, grifería e instalaciones.', 'droplets'),
  ('cerrajeria', 'cerrajeria', 'Cerrajería', 'Aperturas, cerraduras y copias de llaves.', 'key-round'),
  ('climatizacion', 'climatizacion', 'Climatización', 'Aire acondicionado y calefacción confiable.', 'snowflake'),
  ('tecnologia', 'tecnologia', 'Tecnología', 'Computadores, redes y seguridad digital.', 'monitor-cog'),
  ('electrodomesticos', 'electrodomesticos', 'Electrodomésticos', 'Reparación y mantención para tu hogar.', 'wrench'),
  ('pintura', 'pintura', 'Pintura', 'Pintura interior, exterior y terminaciones.', 'paint-roller'),
  ('jardineria', 'jardineria', 'Jardinería', 'Mantención, riego y paisajismo.', 'sprout')
on conflict (id) do update set name = excluded.name, description = excluded.description, icon = excluded.icon;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.technician_profiles enable row level security;
alter table public.technician_categories enable row level security;
alter table public.technician_specialties enable row level security;
alter table public.technician_metrics enable row level security;
alter table public.technician_documents enable row level security;
alter table public.service_requests enable row level security;
alter table public.admin_audit_entries enable row level security;

create policy "Public profiles are visible for public technicians" on public.profiles for select using (
  id = auth.uid() or public.is_admin() or exists (
    select 1 from public.technician_profiles where user_id = profiles.id and status in ('verified', 'active')
  )
);
create policy "Categories are public" on public.categories for select using (true);
create policy "Public technicians are visible and private profiles remain scoped" on public.technician_profiles for select using (
  status in ('verified', 'active') or user_id = auth.uid() or public.is_admin()
);
create policy "Technician categories follow profile visibility" on public.technician_categories for select using (
  technician_id = auth.uid() or public.is_admin() or exists (
    select 1 from public.technician_profiles where user_id = technician_categories.technician_id and status in ('verified', 'active')
  )
);
create policy "Technician specialties follow profile visibility" on public.technician_specialties for select using (
  technician_id = auth.uid() or public.is_admin() or exists (
    select 1 from public.technician_profiles where user_id = technician_specialties.technician_id and status in ('verified', 'active')
  )
);
create policy "Technician metrics follow profile visibility" on public.technician_metrics for select using (
  technician_id = auth.uid() or public.is_admin() or exists (
    select 1 from public.technician_profiles where user_id = technician_metrics.technician_id and status in ('verified', 'active')
  )
);
create policy "Technicians and administrators view their documents" on public.technician_documents for select using (technician_id = auth.uid() or public.is_admin());
create policy "Customers create their own service requests" on public.service_requests for insert with check (
  customer_id = auth.uid() and exists (select 1 from public.profiles where id = auth.uid() and role = 'customer')
);
create policy "Customers view their own service requests" on public.service_requests for select using (
  customer_id = auth.uid() or assigned_technician_id = public.active_technician_id() or public.is_admin()
);
create policy "Administrators read audit entries" on public.admin_audit_entries for select using (public.is_admin());

insert into storage.buckets (id, name, public)
values ('technician-documents', 'technician-documents', false)
on conflict (id) do nothing;

create policy "Technicians upload their own documents" on storage.objects for insert to authenticated with check (
  bucket_id = 'technician-documents' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "Technicians and administrators view verification documents" on storage.objects for select to authenticated using (
  bucket_id = 'technician-documents' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);

revoke insert, update, delete on public.profiles from anon, authenticated;
revoke insert, update, delete on public.technician_profiles from anon, authenticated;
revoke insert, update, delete on public.technician_categories from anon, authenticated;
revoke insert, update, delete on public.technician_specialties from anon, authenticated;
revoke insert, update, delete on public.technician_metrics from anon, authenticated;
revoke insert, update, delete on public.admin_audit_entries from anon, authenticated;
revoke update, delete on public.service_requests from anon, authenticated;
grant execute on function public.change_technician_status(uuid, public.technician_status, text) to authenticated;
notify pgrst, 'reload schema';
