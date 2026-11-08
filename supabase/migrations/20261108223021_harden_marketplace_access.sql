-- Additive hardening. Apply only after the existing baseline is reconciled.
-- No user rows are deleted, no roles are reassigned, no commercial state is advanced.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = pg_catalog
as $$
  select exists (select 1 from public.profiles
    where id = (select auth.uid()) and role in ('moderator', 'superadmin'));
$$;
create or replace function private.active_technician_id()
returns uuid language sql stable security definer set search_path = pg_catalog
as $$
  select t.user_id from public.technician_profiles t
  join public.profiles p on p.id = t.user_id
  where t.user_id = (select auth.uid()) and t.status = 'active' and p.role = 'technician'
  limit 1;
$$;
revoke all on function private.is_admin() from public;
revoke all on function private.active_technician_id() from public;
-- Needed by RLS, not exposed through PostgREST's public schema.
grant execute on function private.is_admin(), private.active_technician_id() to anon, authenticated;

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
  if not private.is_admin() then
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

alter function public.technician_status_transition_allowed(public.technician_status, public.technician_status)
  set search_path = pg_catalog;
revoke execute on function public.is_admin(), public.active_technician_id(), public.handle_new_user(), public.touch_updated_at(),
  public.technician_status_transition_allowed(public.technician_status, public.technician_status)
  from public, anon, authenticated;
revoke execute on function public.change_technician_status(uuid, public.technician_status, text) from public, anon;
grant execute on function public.change_technician_status(uuid, public.technician_status, text) to authenticated;

-- Explicit grants; RLS continues to authorize individual rows.
revoke truncate, references, trigger on public.profiles, public.categories, public.technician_profiles,
  public.technician_categories, public.technician_specialties, public.technician_metrics,
  public.technician_documents, public.service_requests, public.admin_audit_entries from anon, authenticated;
revoke insert, update, delete on public.categories, public.technician_documents from anon, authenticated;
revoke insert on public.service_requests from anon;
revoke select on public.technician_documents, public.admin_audit_entries, public.service_requests from anon;
grant select on public.profiles, public.categories, public.technician_profiles,
  public.technician_categories, public.technician_specialties, public.technician_metrics to anon, authenticated;
grant select on public.technician_documents, public.service_requests, public.admin_audit_entries to authenticated;
grant insert on public.service_requests to authenticated;
-- Keep UPDATE/DELETE denied: commercial transitions will use authorized RPCs.
revoke update, delete on public.service_requests from anon, authenticated;

alter policy "Public profiles are visible for public technicians" on public.profiles
  using (id = (select auth.uid()) or (select private.is_admin()) or exists (
    select 1 from public.technician_profiles where user_id = profiles.id and status in ('verified', 'active')));
alter policy "Public technicians are visible and private profiles remain scoped" on public.technician_profiles
  using (status in ('verified', 'active') or user_id = (select auth.uid()) or (select private.is_admin()));
alter policy "Technician categories follow profile visibility" on public.technician_categories
  using (technician_id = (select auth.uid()) or (select private.is_admin()) or exists (
    select 1 from public.technician_profiles where user_id = technician_categories.technician_id and status in ('verified', 'active')));
alter policy "Technician specialties follow profile visibility" on public.technician_specialties
  using (technician_id = (select auth.uid()) or (select private.is_admin()) or exists (
    select 1 from public.technician_profiles where user_id = technician_specialties.technician_id and status in ('verified', 'active')));
alter policy "Technician metrics follow profile visibility" on public.technician_metrics
  using (technician_id = (select auth.uid()) or (select private.is_admin()) or exists (
    select 1 from public.technician_profiles where user_id = technician_metrics.technician_id and status in ('verified', 'active')));
alter policy "Technicians and administrators view their documents" on public.technician_documents to authenticated
  using ((select private.is_admin()) or (technician_id = (select auth.uid()) and exists (
    select 1 from public.profiles where id = (select auth.uid()) and role = 'technician')));
alter policy "Customers create their own service requests" on public.service_requests to authenticated
  with check (customer_id = (select auth.uid()) and status = 'submitted' and assigned_technician_id is null
    and exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'customer'));
alter policy "Customers view their own service requests" on public.service_requests to authenticated
  using (customer_id = (select auth.uid()) or assigned_technician_id = (select private.active_technician_id()) or (select private.is_admin()));
alter policy "Administrators read audit entries" on public.admin_audit_entries to authenticated
  using ((select private.is_admin()));

update storage.buckets set public = false, file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png']
where id = 'technician-documents';
alter policy "Technicians upload their own documents" on storage.objects to authenticated
  with check (bucket_id = 'technician-documents' and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.profiles p join public.technician_profiles t on t.user_id = p.id
      where p.id = (select auth.uid()) and p.role = 'technician'
        and t.status in ('draft', 'pending_verification', 'needs_information', 'verified', 'active')));
alter policy "Technicians and administrators view verification documents" on storage.objects to authenticated
  using (bucket_id = 'technician-documents' and ((select private.is_admin()) or (
    (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'technician'))));

-- RPC and RLS helpers stay SECURITY DEFINER with a fixed path and explicit guard.
notify pgrst, 'reload schema';
commit;
