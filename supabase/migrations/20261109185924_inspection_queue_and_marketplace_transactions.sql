-- Sprint 02.5/03. Additive marketplace. Apply only after explicit remote approval.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

alter table public.service_requests add column revision integer not null default 1;
create index service_requests_opportunities_idx on public.service_requests(category_id,created_at desc,id)
 where status in ('submitted','matching','receiving_quotes') and priority='standard';
create table private.service_request_details (
 request_id uuid primary key references public.service_requests(id) on delete cascade,
 address text not null default '' check(length(address)<=300),
 reference text not null default '' check(length(reference)<=500),
 preferred_slot text not null default '' check(length(preferred_slot)<=100),
 complementary_info text not null default '' check(length(complementary_info)<=1000)
);
create table public.quotes (
 id uuid primary key default gen_random_uuid(),
 service_request_id uuid not null references public.service_requests(id) on delete cascade,
 technician_id uuid not null references public.technician_profiles(user_id),
 labor_clp integer not null check(labor_clp between 0 and 50000000),
 materials_clp integer not null default 0 check(materials_clp between 0 and 50000000),
 diagnostic_clp integer not null default 0 check(diagnostic_clp between 0 and 50000000),
 price_clp integer generated always as (labor_clp+materials_clp+diagnostic_clp) stored,
 description text not null check(length(trim(description)) between 20 and 2000),
 materials_included text not null default '' check(length(materials_included)<=600),
 materials_not_included text not null default '' check(length(materials_not_included)<=600),
 diagnostic_visit boolean not null default false,
 estimated_duration text not null check(length(trim(estimated_duration)) between 2 and 120),
 available_date timestamptz not null, conditions text not null default '' check(length(conditions)<=1000),
 expires_at timestamptz not null,
 status text not null default 'draft' check(status in ('draft','submitted','accepted','rejected','withdrawn','expired')),
 revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(service_request_id,technician_id), check(labor_clp+materials_clp+diagnostic_clp between 1000 and 50000000),
 check(diagnostic_visit or diagnostic_clp=0)
);
create unique index quotes_one_accepted_idx on public.quotes(service_request_id) where status='accepted';
create index quotes_technician_idx on public.quotes(technician_id,created_at desc,id);
create table public.jobs (
 id uuid primary key default gen_random_uuid(),
 service_request_id uuid not null unique references public.service_requests(id) on delete cascade,
 quote_id uuid not null unique references public.quotes(id),
 customer_id uuid not null references public.profiles(id), technician_id uuid not null references public.technician_profiles(user_id),
 status text not null default 'awarded' check(status='awarded'),
 payment_state text not null default 'not_enabled' check(payment_state='not_enabled'),
 snapshot jsonb not null check(jsonb_typeof(snapshot)='object'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index jobs_customer_idx on public.jobs(customer_id,created_at desc);
create index jobs_technician_idx on public.jobs(technician_id,created_at desc);
create table private.marketplace_events (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references public.service_requests(id) on delete cascade,
 quote_id uuid references public.quotes(id) on delete cascade, job_id uuid references public.jobs(id) on delete cascade,
 actor_id uuid not null references public.profiles(id), action text not null,
 previous_state text, next_state text, created_at timestamptz not null default now()
);
create index marketplace_events_request_idx on private.marketplace_events(request_id,created_at,id);
create index marketplace_events_actor_idx on private.marketplace_events(actor_id);
create index marketplace_events_quote_idx on private.marketplace_events(quote_id);
create index marketplace_events_job_idx on private.marketplace_events(job_id);
create table private.marketplace_operations (
 actor_id uuid not null references public.profiles(id) on delete cascade, operation_id uuid not null,
 kind text not null, payload jsonb not null, resource_id uuid not null, created_at timestamptz not null default now(),
 primary key(actor_id,operation_id)
);
alter table private.service_request_details enable row level security;
alter table private.marketplace_events enable row level security;
alter table private.marketplace_operations enable row level security;
alter table public.quotes enable row level security;
alter table public.jobs enable row level security;
revoke all on private.service_request_details,private.marketplace_events,private.marketplace_operations from public,anon,authenticated;
revoke all on public.quotes,public.jobs from public,anon,authenticated;
grant select on public.quotes,public.jobs to authenticated;
-- Publication and cancellation now exclusively use atomic RPCs (legacy INSERT intentionally retired).
revoke insert,update,delete on public.service_requests from authenticated,anon;

create function private.marketplace_actor(expected_role public.app_role default null)
returns uuid language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if not private.is_active_account() or (expected_role is not null and not exists(
 select 1 from public.profiles where id=auth.uid() and role=expected_role)) then
 raise exception 'Cuenta no habilitada para esta operación' using errcode='42501'; end if;
 return auth.uid();
end; $$;
create function private.normalized_commune(value text)
returns text language sql immutable set search_path=pg_catalog as $$
 select regexp_replace(lower(translate(trim(value),'ÁÉÍÓÚÜÑáéíóúüñ','AEIOUUNaeiouun')),'\s+',' ','g');
$$;
create function private.marketplace_eligible(request_id uuid, technician uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from public.service_requests r
 join public.technician_categories c on c.category_id=r.category_id and c.technician_id=technician
 join public.technician_profiles t on t.user_id=c.technician_id
 join public.profiles owner on owner.id=r.customer_id
 where r.id=request_id and r.status in ('submitted','matching','receiving_quotes') and r.priority='standard'
 and owner.account_status='active' and t.status='active' and private.public_technician(technician)
 and private.normalized_commune(r.location_label)=any(array(select private.normalized_commune(x) from unnest(t.coverage_areas) x)));
$$;
create function private.marketplace_receipt(op uuid, operation_kind text, value jsonb)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare receipt private.marketplace_operations;
begin
 if op is null then raise exception 'Identificador de operación obligatorio' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||op::text,71301423));
 select * into receipt from private.marketplace_operations where actor_id=auth.uid() and operation_id=op;
 if found and (receipt.kind<>operation_kind or receipt.payload<>value) then
 raise exception 'Identificador utilizado con otros datos' using errcode='PT409'; end if;
 return receipt.resource_id;
end; $$;
create function private.marketplace_immutable()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 if tg_table_name='jobs' or old.status='accepted' then
 raise exception 'Condiciones adjudicadas inmutables' using errcode='PT409'; end if;
 return new;
end; $$;
create trigger immutable_job before update on public.jobs for each row execute function private.marketplace_immutable();
create trigger immutable_accepted_quote before update on public.quotes for each row execute function private.marketplace_immutable();

create policy quotes_participants on public.quotes for select to authenticated using(
 (select private.is_active_account()) and (technician_id=(select auth.uid()) or (status<>'draft' and exists(
 select 1 from public.service_requests r where r.id=service_request_id and r.customer_id=(select auth.uid()))) or (select private.is_admin())));
create policy jobs_participants on public.jobs for select to authenticated using(
 (select private.is_active_account()) and (customer_id=(select auth.uid()) or technician_id=(select auth.uid()) or (select private.is_admin())));

create function public.marketplace_create_request(operation_id uuid, payload jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare actor uuid; result uuid; row public.service_requests;
begin
 actor:=private.marketplace_actor('customer');
 result:=private.marketplace_receipt(operation_id,'create_request',payload);
 if result is not null then return (select to_jsonb(r) from public.service_requests r where id=result); end if;
 if jsonb_typeof(payload) is distinct from 'object' or payload- array['title','categoryId','description','locationLabel','scheduledFor','address','reference','preferredSlot','complementaryInfo'] <> '{}'::jsonb
 or length(trim(coalesce(payload->>'title',''))) not between 5 and 160
 or length(trim(coalesce(payload->>'description',''))) not between 20 and 3000
 or length(trim(coalesce(payload->>'locationLabel',''))) not between 2 and 100
 then raise exception 'Solicitud inválida' using errcode='22023'; end if;
 if nullif(payload->>'scheduledFor','')::timestamptz < now() or nullif(payload->>'scheduledFor','')::timestamptz > now()+interval '1 year' then
 raise exception 'Fecha fuera de rango' using errcode='22023'; end if;
 -- Serialize the per-account publication limit as well as duplicate operation IDs.
 perform pg_advisory_xact_lock(hashtextextended(actor::text,71301424));
 if (select count(*) from public.service_requests where customer_id=actor and created_at>now()-interval '1 day')>=10 then
 raise exception 'Límite diario de solicitudes alcanzado' using errcode='PT429'; end if;
 insert into public.service_requests(customer_id,category_id,title,description,location_label,scheduled_for)
 values(actor,payload->>'categoryId',trim(payload->>'title'),trim(payload->>'description'),trim(payload->>'locationLabel'),nullif(payload->>'scheduledFor','')::timestamptz) returning * into row;
 insert into private.service_request_details(request_id,address,reference,preferred_slot,complementary_info)
 values(row.id,coalesce(payload->>'address',''),coalesce(payload->>'reference',''),coalesce(payload->>'preferredSlot',''),coalesce(payload->>'complementaryInfo',''));
 insert into private.marketplace_events(request_id,actor_id,action,next_state) values(row.id,actor,'request_published',row.status);
 insert into private.marketplace_operations values(actor,operation_id,'create_request',payload,row.id,now());
 return to_jsonb(row);
end; $$;

create function public.marketplace_cancel_request(request_id uuid, expected_revision integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare actor uuid; row public.service_requests;
begin
 actor:=private.marketplace_actor('customer');
 select * into row from public.service_requests where id=request_id and customer_id=actor for update;
 if not found then raise exception 'Solicitud no disponible' using errcode='42501'; end if;
 if row.status='cancelled' then return to_jsonb(row); end if;
 if row.revision<>expected_revision or row.status not in ('submitted','matching','receiving_quotes') then
 raise exception 'La solicitud cambió o ya fue adjudicada' using errcode='PT409'; end if;
 update public.quotes set status='rejected',revision=revision+1,updated_at=now() where service_request_id=row.id and status in ('draft','submitted');
 insert into private.marketplace_events(request_id,actor_id,action,previous_state,next_state) values(row.id,actor,'request_cancelled',row.status,'cancelled');
 update public.service_requests set status='cancelled',revision=revision+1 where id=row.id returning * into row;
 return to_jsonb(row);
end; $$;

-- A projection, never SELECT *: opportunities contain no customer ID/contact/address.
create function public.marketplace_opportunities(category text default null, page_number integer default 1)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare actor uuid;
begin
 actor:=private.marketplace_actor('technician');
 if page_number not between 1 and 10000 then raise exception 'Página inválida' using errcode='22023'; end if;
 return coalesce((select jsonb_agg(x order by x.created_at desc,x.id) from (
 select r.id,r.title,r.description,r.category_id,r.location_label,r.scheduled_for,r.created_at,r.status,r.priority,r.revision,d.preferred_slot
 from public.service_requests r left join private.service_request_details d on d.request_id=r.id
 where (category is null or r.category_id=category) and private.marketplace_eligible(r.id,actor)
 order by r.created_at desc,r.id limit 20 offset (page_number-1)*20) x),'[]');
end; $$;
create function public.marketplace_request_detail(request_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare actor uuid; row public.service_requests; result jsonb; details jsonb; owner boolean; administrator boolean;
begin
 actor:=private.marketplace_actor(); administrator:=private.is_admin();
 select * into row from public.service_requests where id=request_id;
 if not found then return null; end if;
 owner:=row.customer_id=actor;
 if not owner and not administrator and not (private.marketplace_eligible(row.id,actor) or coalesce(row.assigned_technician_id=actor and private.active_technician_id()=actor,false)) then return null; end if;
 result:=to_jsonb(row)-'customer_id'-'assigned_technician_id';
 if owner or administrator then result:=to_jsonb(row); end if;
 if owner or administrator or (row.assigned_technician_id=actor and private.active_technician_id()=actor) then
 select to_jsonb(d)-'request_id' into details from private.service_request_details d where d.request_id=row.id;
 else select jsonb_build_object('preferred_slot',d.preferred_slot) into details from private.service_request_details d where d.request_id=row.id; end if;
 return result||jsonb_build_object('details',coalesce(details,'{}'),'history',coalesce((select jsonb_agg(to_jsonb(e)-'actor_id' order by created_at,id) from private.marketplace_events e where e.request_id=row.id and (owner or administrator or e.actor_id=actor)),'[]'));
end; $$;
create function public.marketplace_customer_requests(page_number integer default 1)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare actor uuid;
begin
 actor:=private.marketplace_actor('customer');
 if page_number not between 1 and 10000 then raise exception 'Página inválida' using errcode='22023'; end if;
 return jsonb_build_object('total',(select count(*) from public.service_requests where customer_id=actor),'items',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id) from(
 select r.*,(select count(*) from public.quotes q where q.service_request_id=r.id and q.status<>'draft') quote_count
 from public.service_requests r where customer_id=actor order by created_at desc,id limit 20 offset (page_number-1)*20) x),'[]'));
end; $$;

create function public.marketplace_save_quote(request_id uuid, operation_id uuid, payload jsonb, expected_revision integer default 0)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare actor uuid; result uuid; q public.quotes; receipt jsonb;
begin
 actor:=private.marketplace_actor('technician'); receipt:=jsonb_build_object('request',request_id,'data',payload,'revision',expected_revision);
 result:=private.marketplace_receipt(operation_id,'save_quote',receipt);
 if result is not null then return (select to_jsonb(x) from public.quotes x where id=result); end if;
 -- All commercial operations lock the request before quotes. Approval/identity changes use these same ordered global locks.
 perform pg_advisory_xact_lock(71301421); perform pg_advisory_xact_lock(71301422);
 perform 1 from public.service_requests where id=request_id for update;
 if not private.marketplace_eligible(request_id,actor) then raise exception 'Oportunidad no habilitada' using errcode='42501'; end if;
 if jsonb_typeof(payload) is distinct from 'object' or payload-array['laborClp','materialsClp','diagnosticClp','description','materialsIncluded','materialsNotIncluded','diagnosticVisit','estimatedDuration','availableDate','conditions','expiresAt']<>'{}'::jsonb
 then raise exception 'Cotización inválida' using errcode='22023'; end if;
 if (payload->>'expiresAt')::timestamptz <= now() or (payload->>'expiresAt')::timestamptz>now()+interval '30 days'
 or (payload->>'availableDate')::timestamptz<now() or (payload->>'availableDate')::timestamptz>now()+interval '1 year'
 then raise exception 'Vigencia o disponibilidad inválida' using errcode='22023'; end if;
 select * into q from public.quotes where service_request_id=request_id and technician_id=actor for update;
 if found and (q.status not in ('draft','withdrawn') or q.revision<>expected_revision) or (not found and expected_revision<>0) then
 raise exception 'Cotización modificada; actualiza antes de editar' using errcode='PT409'; end if;
 insert into public.quotes(id,service_request_id,technician_id,labor_clp,materials_clp,diagnostic_clp,description,materials_included,materials_not_included,diagnostic_visit,estimated_duration,available_date,conditions,expires_at)
 values(coalesce(q.id,gen_random_uuid()),request_id,actor,(payload->>'laborClp')::integer,(payload->>'materialsClp')::integer,(payload->>'diagnosticClp')::integer,payload->>'description',coalesce(payload->>'materialsIncluded',''),coalesce(payload->>'materialsNotIncluded',''),(payload->>'diagnosticVisit')::boolean,payload->>'estimatedDuration',(payload->>'availableDate')::timestamptz,coalesce(payload->>'conditions',''),(payload->>'expiresAt')::timestamptz)
 on conflict(service_request_id,technician_id) do update set labor_clp=excluded.labor_clp,materials_clp=excluded.materials_clp,diagnostic_clp=excluded.diagnostic_clp,
 description=excluded.description,materials_included=excluded.materials_included,materials_not_included=excluded.materials_not_included,diagnostic_visit=excluded.diagnostic_visit,
 estimated_duration=excluded.estimated_duration,available_date=excluded.available_date,conditions=excluded.conditions,expires_at=excluded.expires_at,status='draft',revision=public.quotes.revision+1,updated_at=now() returning * into q;
 insert into private.marketplace_events(request_id,quote_id,actor_id,action,next_state) values(request_id,q.id,actor,'quote_saved','draft');
 insert into private.marketplace_operations values(actor,operation_id,'save_quote',receipt,q.id,now());
 return to_jsonb(q);
end; $$;
create function public.marketplace_transition_quote(quote_id uuid, next_status text, expected_revision integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare actor uuid; q public.quotes; request_id uuid; previous text;
begin
 actor:=private.marketplace_actor('technician');
 perform pg_advisory_xact_lock(71301421); perform pg_advisory_xact_lock(71301422);
 select service_request_id into request_id from public.quotes where id=quote_id and technician_id=actor;
 perform 1 from public.service_requests where id=request_id for update;
 select * into q from public.quotes where id=quote_id and technician_id=actor for update;
 if not found or not private.marketplace_eligible(request_id,actor) then raise exception 'Cotización no habilitada' using errcode='42501'; end if;
 if next_status not in ('submitted','withdrawn') or next_status is null then raise exception 'Transición inválida' using errcode='22023'; end if;
 if q.status=next_status then return to_jsonb(q); end if;
 if q.revision<>expected_revision or (next_status='submitted' and (q.status<>'draft' or q.expires_at<=now() or q.available_date<now()))
 or (next_status='withdrawn' and q.status not in ('draft','submitted')) then raise exception 'Cotización modificada o vencida' using errcode='PT409'; end if;
 previous:=q.status;
 update public.quotes set status=next_status,revision=revision+1,updated_at=now() where id=q.id returning * into q;
 if next_status='submitted' then
 update public.service_requests set status='receiving_quotes',revision=revision+1 where id=request_id and status in ('submitted','matching'); end if;
 insert into private.marketplace_events(request_id,quote_id,actor_id,action,previous_state,next_state) values(request_id,q.id,actor,'quote_'||next_status,previous,next_status);
 return to_jsonb(q);
end; $$;

create function public.marketplace_accept_quote(request_id uuid, quote_id uuid, expected_revision integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare actor uuid; r public.service_requests; q public.quotes; j public.jobs; terms jsonb;
begin
 actor:=private.marketplace_actor('customer');
 perform pg_advisory_xact_lock(71301421); perform pg_advisory_xact_lock(71301422);
 select * into r from public.service_requests where id=request_id and customer_id=actor for update;
 if not found then raise exception 'Solicitud no disponible' using errcode='42501'; end if;
 select * into q from public.quotes where id=quote_id and service_request_id=r.id for update;
 if not found then raise exception 'Cotización no disponible' using errcode='42501'; end if;
 select * into j from public.jobs where service_request_id=r.id;
 if found then
 if j.quote_id=q.id then return jsonb_build_object('request',to_jsonb(r),'quote',to_jsonb(q),'job',to_jsonb(j)); end if;
 raise exception 'La solicitud ya fue adjudicada' using errcode='PT409'; end if;
 -- Lock profile/application rows too: legacy profile edits invalidate approval without the global lock.
 perform 1 from public.profiles where id in (actor,q.technician_id) order by id for share;
 perform 1 from public.technician_profiles where user_id=q.technician_id for share;
 perform 1 from private.technician_applications where technician_id=q.technician_id for share;
 if r.status<>'receiving_quotes' or q.status<>'submitted' or q.revision<>expected_revision or q.expires_at<=now() or q.available_date<now()
 or not private.marketplace_eligible(r.id,q.technician_id) then raise exception 'La propuesta cambió, venció o el técnico perdió habilitación' using errcode='PT409'; end if;
 terms:=jsonb_build_object('quoteId',q.id,'serviceRequestId',r.id,'technicianId',q.technician_id,'priceClp',q.price_clp,'currency','CLP',
 'laborClp',q.labor_clp,'materialsClp',q.materials_clp,'diagnosticClp',q.diagnostic_clp,'revision',q.revision,
 'description',q.description,'materialsIncluded',q.materials_included,'materialsNotIncluded',q.materials_not_included,
 'diagnosticVisit',q.diagnostic_visit,'estimatedDuration',q.estimated_duration,'availableDate',q.available_date,'conditions',q.conditions,'expiresAt',q.expires_at,'acceptedAt',now(),
 'professionalFingerprint',private.professional_fingerprint(q.technician_id));
 update public.quotes set status='accepted',revision=revision+1,updated_at=now() where id=q.id returning * into q;
 update public.quotes set status='rejected',revision=revision+1,updated_at=now() where service_request_id=r.id and id<>q.id and status in ('submitted','draft');
 update public.service_requests set status='technician_selected',assigned_technician_id=q.technician_id,revision=revision+1 where id=r.id returning * into r;
 insert into public.jobs(service_request_id,quote_id,customer_id,technician_id,snapshot) values(r.id,q.id,actor,q.technician_id,terms) returning * into j;
 insert into private.marketplace_events(request_id,quote_id,job_id,actor_id,action,previous_state,next_state) values(r.id,q.id,j.id,actor,'quote_accepted','receiving_quotes','technician_selected');
 return jsonb_build_object('request',to_jsonb(r),'quote',to_jsonb(q),'job',to_jsonb(j));
end; $$;

create function public.marketplace_admin_requests(page_number integer default 1, state_filter text default null)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 perform private.require_administrator();
 if page_number not between 1 and 10000 then raise exception 'Página inválida' using errcode='22023'; end if;
 return coalesce((select jsonb_agg(to_jsonb(x) order by created_at desc,id) from(
 select r.*,p.full_name customer_name,(select count(*) from public.quotes q where q.service_request_id=r.id) quote_count,
 (select count(*) from public.technician_profiles t where private.marketplace_eligible(r.id,t.user_id)) eligible_count,
 (select j.id from public.jobs j where j.service_request_id=r.id) job_id
 from public.service_requests r join public.profiles p on p.id=r.customer_id where state_filter is null or r.status::text=state_filter
 order by r.created_at desc,r.id limit 20 offset(page_number-1)*20)x),'[]');
end; $$;

-- Photos are private and can only be uploaded by the validated server transcoder.
create table private.service_request_photos (
 id uuid primary key, request_id uuid not null references public.service_requests(id) on delete cascade,
 storage_path text not null unique, sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
 byte_size integer not null check(byte_size between 1 and 4194304), created_at timestamptz not null default now()
);
create index service_request_photos_request_idx on private.service_request_photos(request_id);
alter table private.service_request_photos enable row level security;
revoke all on private.service_request_photos from public,anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('service-request-photos','service-request-photos',false,4194304,array['image/jpeg']);
create function public.marketplace_admin_detail(request_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 perform private.require_administrator();
 return jsonb_build_object('request',public.marketplace_request_detail(request_id),
 'quotes',coalesce((select jsonb_agg(to_jsonb(q) order by created_at,id) from public.quotes q where q.service_request_id=request_id),'[]'),
 'job',(select to_jsonb(j) from public.jobs j where j.service_request_id=request_id),
 'eligible',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.full_name)) from public.profiles p where private.marketplace_eligible(request_id,p.id)),'[]'),
 'history',coalesce((select jsonb_agg(to_jsonb(e) order by created_at,id) from private.marketplace_events e where e.request_id=marketplace_admin_detail.request_id),'[]'));
end; $$;
revoke all on function public.marketplace_admin_detail(uuid) from public,anon,authenticated;
grant execute on function public.marketplace_admin_detail(uuid) to authenticated;
create function private.can_read_request_photo(path text)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select private.is_active_account() and exists(select 1 from private.service_request_photos p
 join public.service_requests r on r.id=p.request_id where p.storage_path=path and
 (r.customer_id=auth.uid() or private.is_admin() or (r.assigned_technician_id=auth.uid() and private.active_technician_id()=auth.uid())));
$$;
revoke all on function private.can_read_request_photo(text) from public,anon,authenticated;
grant execute on function private.can_read_request_photo(text) to authenticated;
create policy request_photos_private on storage.objects for select to authenticated
 using(bucket_id='service-request-photos' and private.can_read_request_photo(name));
create function public.marketplace_register_photo(request_id uuid, photo_id uuid, content_sha256 text, content_size integer)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare actor uuid; path text; r public.service_requests;
begin
 actor:=private.marketplace_actor('customer');
 select * into r from public.service_requests where id=request_id and customer_id=actor for update;
 if not found or r.status not in ('submitted','matching','receiving_quotes') then raise exception 'Solicitud no disponible' using errcode='42501'; end if;
 path:=actor::text||'/'||request_id::text||'/'||photo_id::text||'.jpg';
 if exists(select 1 from private.service_request_photos p where p.id=photo_id and p.request_id=marketplace_register_photo.request_id and p.sha256=content_sha256 and p.byte_size=content_size) then return; end if;
 if (select count(*) from private.service_request_photos p where p.request_id=marketplace_register_photo.request_id)>=5
 or not exists(select 1 from storage.objects where bucket_id='service-request-photos' and name=path) then raise exception 'Límite de fotos o archivo no disponible' using errcode='22023'; end if;
 insert into private.service_request_photos values(photo_id,request_id,path,content_sha256,content_size,now());
 insert into private.marketplace_events(request_id,actor_id,action,next_state) values(request_id,actor,'photo_added',r.status);
end; $$;
create function public.marketplace_photos(request_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 perform private.marketplace_actor();
 return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'storage_path',p.storage_path) order by created_at,id)
 from private.service_request_photos p where p.request_id=marketplace_photos.request_id and private.can_read_request_photo(p.storage_path)),'[]');
end; $$;
revoke all on function public.marketplace_register_photo(uuid,uuid,text,integer),public.marketplace_photos(uuid) from public,anon,authenticated;
grant execute on function public.marketplace_register_photo(uuid,uuid,text,integer),public.marketplace_photos(uuid) to authenticated;

-- Durable inspection queue. Only the trusted worker can lease/finish jobs.
create table private.inspection_jobs (
 document_id uuid primary key references public.technician_documents(id) on delete cascade,
 state text not null default 'pending' check(state in ('pending','leased','complete','dead')),
 attempts integer not null default 0 check(attempts between 0 and 5), available_at timestamptz not null default now(),
 lease_token uuid, lease_until timestamptz, failure_code text,
 updated_at timestamptz not null default now()
);
create index inspection_jobs_pending_idx on private.inspection_jobs(available_at,document_id) where state in ('pending','leased');
alter table private.inspection_jobs enable row level security;
revoke all on private.inspection_jobs from public,anon,authenticated;
create function private.enqueue_professional_inspection()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 if new.current_document and new.inspection_status in ('quarantined','error') then
 insert into private.inspection_jobs(document_id) values(new.id) on conflict do nothing; end if;
 return new;
end; $$;
create trigger enqueue_professional_inspection after insert on public.technician_documents for each row execute function private.enqueue_professional_inspection();
insert into private.inspection_jobs(document_id) select id from public.technician_documents where current_document and inspection_status in ('quarantined','error');
create function public.claim_professional_inspection()
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare job private.inspection_jobs; path text;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Worker requerido' using errcode='42501'; end if;
 update private.inspection_jobs set state='dead',lease_token=null,lease_until=null,updated_at=now(),failure_code='attempts_exhausted'
 where state='leased' and lease_until<now() and attempts>=5;
 select j.* into job from private.inspection_jobs j join public.technician_documents d on d.id=j.document_id
 where d.current_document and d.inspection_status in ('quarantined','error') and j.attempts<5
 and ((j.state='pending' and j.available_at<=now()) or (j.state='leased' and j.lease_until<now()))
 order by j.available_at,j.document_id for update of j skip locked limit 1;
 if not found then return null; end if;
 update private.inspection_jobs set state='leased',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes',updated_at=now()
 where document_id=job.document_id returning * into job;
 select storage_path into path from public.technician_documents where id=job.document_id;
 return jsonb_build_object('document_id',job.document_id,'storage_path',path,'lease_token',job.lease_token,'lease_until',job.lease_until,'attempt',job.attempts);
end; $$;
create function public.finish_professional_inspection(document_id uuid, lease_token uuid, result jsonb)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare job private.inspection_jobs; outcome text;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Worker requerido' using errcode='42501'; end if;
 select * into job from private.inspection_jobs j where j.document_id=finish_professional_inspection.document_id for update;
 if job.state='complete' and job.lease_token=finish_professional_inspection.lease_token then return; end if;
 if not found or job.state<>'leased' or job.lease_token is distinct from finish_professional_inspection.lease_token or job.lease_until<=now()
 then raise exception 'Lease vencido o reemplazado' using errcode='PT409'; end if;
 outcome:=result->>'result';
 if outcome in ('clean','unsafe') then
 perform public.record_professional_inspection(document_id,result->>'sha256',result->>'mime',(result->>'size')::integer,outcome,result->>'engine');
 update private.inspection_jobs j set state='complete',failure_code=null,updated_at=now() where j.document_id=finish_professional_inspection.document_id;
 else
 -- Infrastructure/validation failures never mark clean; retry bounded, leave quarantined.
 update private.inspection_jobs j set state=case when attempts>=5 then 'dead' else 'pending' end,
 available_at=now()+make_interval(secs=>least(3600,30*power(2,attempts)::integer)),lease_until=null,lease_token=null,
 failure_code='inspection_failed',updated_at=now() where j.document_id=finish_professional_inspection.document_id;
 end if;
end; $$;

-- No implicit PUBLIC execution on either internal helpers or public RPCs.
revoke all on function private.marketplace_actor(public.app_role),private.normalized_commune(text),private.marketplace_eligible(uuid,uuid),private.marketplace_receipt(uuid,text,jsonb),private.marketplace_immutable(),private.enqueue_professional_inspection() from public,anon,authenticated;
revoke all on function public.marketplace_create_request(uuid,jsonb),public.marketplace_cancel_request(uuid,integer),public.marketplace_opportunities(text,integer),public.marketplace_request_detail(uuid),public.marketplace_customer_requests(integer),public.marketplace_save_quote(uuid,uuid,jsonb,integer),public.marketplace_transition_quote(uuid,text,integer),public.marketplace_accept_quote(uuid,uuid,integer),public.marketplace_admin_requests(integer,text),public.claim_professional_inspection(),public.finish_professional_inspection(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.marketplace_create_request(uuid,jsonb),public.marketplace_cancel_request(uuid,integer),public.marketplace_opportunities(text,integer),public.marketplace_request_detail(uuid),public.marketplace_customer_requests(integer),public.marketplace_save_quote(uuid,uuid,jsonb,integer),public.marketplace_transition_quote(uuid,text,integer),public.marketplace_accept_quote(uuid,uuid,integer),public.marketplace_admin_requests(integer,text) to authenticated;
grant execute on function public.claim_professional_inspection(),public.finish_professional_inspection(uuid,uuid,jsonb) to service_role;
commit;
