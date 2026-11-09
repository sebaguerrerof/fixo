-- A reviewed primary category must never authorize an unreviewed secondary one.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create or replace function private.marketplace_eligible(request_id uuid, technician uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from public.service_requests r
 join public.technician_categories c on c.category_id=r.category_id and c.technician_id=technician
 join public.technician_profiles t on t.user_id=c.technician_id
 join private.technician_applications a on a.technician_id=t.user_id and a.primary_category=r.category_id
 join public.profiles owner on owner.id=r.customer_id
 where r.id=request_id and r.status in ('submitted','matching','receiving_quotes') and r.priority='standard'
 and owner.account_status='active' and t.status='active' and private.public_technician(technician)
 and private.normalized_commune(r.location_label)=any(array(select private.normalized_commune(x) from unnest(t.coverage_areas) x)));
$$;
revoke all on function private.marketplace_eligible(uuid,uuid) from public,anon,authenticated;
commit;
