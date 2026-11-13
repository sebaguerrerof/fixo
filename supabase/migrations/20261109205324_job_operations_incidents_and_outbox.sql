-- Sprint 04. Remote execution requires specific approval. Execution defaults disabled.
begin;
set local lock_timeout='5s'; set local statement_timeout='30s';
alter table public.jobs drop constraint jobs_status_check;
alter table public.jobs add constraint jobs_status_check check(status in
 ('awarded','coordination_pending','date_proposed','scheduled','ready','in_progress','completion_reported','completed','cancelled','disputed'));
alter table public.jobs add column revision integer not null default 1 check(revision>0),
 add column confirmed_schedule_id uuid, add column started_at timestamptz,
 add column completion_reported_at timestamptz, add column customer_confirmed_at timestamptz;
-- Financial state remains constrained to not_enabled until a separately reviewed Flow integration.
revoke update,insert,delete on public.jobs from anon,authenticated,service_role;
create table private.job_execution_policies(
 job_id uuid primary key references public.jobs(id) on delete cascade,
 mode text not null default 'disabled' check(mode in('disabled','payment_required','authorized_pilot')),
 approved_by uuid references public.profiles(id), reason text, authorized_at timestamptz, expires_at timestamptz,
 check(mode<>'authorized_pilot' or (approved_by is not null and reason is not null and length(trim(reason)) between 10 and 1000
 and authorized_at is not null and expires_at is not null and expires_at>authorized_at))
);
create index job_execution_approver_idx on private.job_execution_policies(approved_by);
create table private.job_schedule_proposals(
 id uuid primary key default gen_random_uuid(), job_id uuid not null references public.jobs(id) on delete cascade,
 actor_id uuid not null references public.profiles(id), starts_at timestamptz not null, ends_at timestamptz not null,
 time_zone text not null default 'America/Santiago' check(time_zone='America/Santiago'),
 state text not null default 'proposed' check(state in('proposed','accepted','rejected','superseded','cancelled')),
 reason text not null default '' check(length(reason)<=1000), version integer not null,
 responded_by uuid references public.profiles(id), created_at timestamptz not null default now(),
 check(ends_at>starts_at and ends_at-starts_at<=interval '12 hours')
);
create unique index job_one_schedule_proposal_idx on private.job_schedule_proposals(job_id) where state='proposed';
create index job_schedule_history_idx on private.job_schedule_proposals(job_id,created_at,id);
create index job_schedule_actor_idx on private.job_schedule_proposals(actor_id);
create index job_schedule_responder_idx on private.job_schedule_proposals(responded_by);
alter table public.jobs add constraint jobs_confirmed_schedule_fkey foreign key(confirmed_schedule_id) references private.job_schedule_proposals(id) deferrable initially deferred;
create index jobs_confirmed_schedule_idx on public.jobs(confirmed_schedule_id);
create table private.job_cancellations(
 id uuid primary key default gen_random_uuid(),job_id uuid not null references public.jobs(id) on delete cascade,
 actor_id uuid not null references public.profiles(id),reason text not null check(length(trim(reason)) between 10 and 1000),
 previous_state text not null,state text not null default 'pending' check(state in('pending','approved','rejected')),
 resolved_by uuid references public.profiles(id),resolution text,created_at timestamptz not null default now(),resolved_at timestamptz
);
create unique index job_pending_cancellation_idx on private.job_cancellations(job_id) where state='pending';
create index job_cancellation_actor_idx on private.job_cancellations(actor_id);
create index job_cancellation_resolver_idx on private.job_cancellations(resolved_by);
create table private.job_incidents(
 id uuid primary key default gen_random_uuid(),job_id uuid not null references public.jobs(id) on delete cascade,
 opened_by uuid not null references public.profiles(id),kind text not null check(kind in('quality','attendance','scope','conduct','other')),
 description text not null check(length(trim(description)) between 20 and 3000),
 state text not null default 'open' check(state in('open','waiting_customer','waiting_technician','resolved')),
 previous_job_state text not null,resolution text,resolved_by uuid references public.profiles(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index job_one_active_incident_idx on private.job_incidents(job_id) where state<>'resolved';
create index job_incident_opener_idx on private.job_incidents(opened_by);
create index job_incident_resolver_idx on private.job_incidents(resolved_by);
create table private.job_incident_messages(
 id uuid primary key default gen_random_uuid(),incident_id uuid not null references private.job_incidents(id) on delete cascade,
 actor_id uuid not null references public.profiles(id),body text not null check(length(trim(body)) between 10 and 3000),
 kind text not null check(kind in('response','information_request','observation','resolution')),created_at timestamptz not null default now()
);
create index job_incident_messages_parent_idx on private.job_incident_messages(incident_id,created_at,id);
create index job_incident_messages_actor_idx on private.job_incident_messages(actor_id);
create table private.job_events(
 id uuid primary key default gen_random_uuid(),job_id uuid not null references public.jobs(id) on delete cascade,
 actor_id uuid not null references public.profiles(id),action text not null,previous_state text,next_state text,
 details jsonb not null default '{}',created_at timestamptz not null default now()
);
create index job_events_history_idx on private.job_events(job_id,created_at,id);
create index job_events_actor_idx on private.job_events(actor_id);
create table private.job_operations(
 actor_id uuid not null references public.profiles(id) on delete cascade,operation_id uuid not null,
 job_id uuid not null references public.jobs(id) on delete cascade,action text not null,payload jsonb not null,
 response jsonb not null,created_at timestamptz not null default now(),primary key(actor_id,operation_id)
);
create index job_operations_job_idx on private.job_operations(job_id);
create table private.notification_outbox(
 id uuid primary key default gen_random_uuid(),event_id uuid not null references private.job_events(id) on delete cascade,
 recipient_id uuid not null references public.profiles(id),template text not null,
 state text not null default 'pending' check(state in('pending','leased','captured','accepted','delivered','dead')),
 attempts integer not null default 0 check(attempts between 0 and 5),available_at timestamptz not null default now(),
 lease_token uuid,lease_until timestamptz,provider_reference text,failure_code text,
 accepted_at timestamptz,delivered_at timestamptz,created_at timestamptz not null default now(),
 unique(event_id,recipient_id)
);
create index notification_outbox_recipient_idx on private.notification_outbox(recipient_id,created_at desc);
create index notification_outbox_pending_idx on private.notification_outbox(available_at,id) where state in('pending','leased');
create table private.job_incident_attachments(
 id uuid primary key,incident_id uuid not null references private.job_incidents(id) on delete cascade,
 actor_id uuid not null references public.profiles(id),storage_path text not null unique,
 sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),byte_size integer not null check(byte_size between 1 and 4194304),
 created_at timestamptz not null default now()
);
create index job_incident_attachments_parent_idx on private.job_incident_attachments(incident_id);
create index job_incident_attachments_actor_idx on private.job_incident_attachments(actor_id);
do $$ declare item text; begin foreach item in array array['job_execution_policies','job_schedule_proposals','job_cancellations','job_incidents','job_incident_messages','job_events','job_operations','notification_outbox','job_incident_attachments'] loop
 execute format('alter table private.%I enable row level security',item);
 execute format('revoke all on private.%I from public,anon,authenticated,service_role',item);
end loop; end $$;

create function private.job_can_read(j public.jobs)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select private.is_active_account() and (auth.uid() in(j.customer_id,j.technician_id) or private.is_admin());
$$;
create function private.job_can_operate(j public.jobs)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select private.is_active_account() and exists(select 1 from public.profiles p where p.id=auth.uid() and
 ((p.id=j.customer_id and p.role='customer') or(p.id=j.technician_id and p.role='technician' and private.active_technician_id()=p.id)));
$$;
create function private.job_execution_allowed(target uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from private.job_execution_policies e join public.profiles p on p.id=e.approved_by
 where e.job_id=target and e.mode='authorized_pilot' and e.authorized_at<=now() and e.expires_at>now() and p.role='superadmin' and p.account_status='active');
 -- payment_required deliberately fails closed: no trusted Flow verification is implemented in Sprint 04.
$$;
create function private.job_emit(target uuid,actor uuid,event_name text,previous text,next text,event_details jsonb default '{}')
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare result uuid; j public.jobs;
begin
 select * into strict j from public.jobs where id=target;
 insert into private.job_events(job_id,actor_id,action,previous_state,next_state,details)
 values(target,actor,event_name,previous,next,event_details) returning id into result;
 insert into private.notification_outbox(event_id,recipient_id,template)
 select result,x,event_name from unnest(array[j.customer_id,j.technician_id])x on conflict do nothing;
 return result;
end; $$;
create function private.initialize_job_operations()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 insert into private.job_execution_policies(job_id)values(new.id);
 perform private.job_emit(new.id,new.customer_id,'quote_accepted',null,new.status);
 perform private.job_emit(new.id,new.customer_id,'job_awarded',null,new.status);
 return new;
end; $$;
create trigger initialize_job_operations after insert on public.jobs for each row execute function private.initialize_job_operations();
create function private.audit_job_execution_policy()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 if to_jsonb(new) is distinct from to_jsonb(old) then
 perform private.job_emit(new.job_id,coalesce(new.approved_by,(select customer_id from public.jobs where id=new.job_id)),
 'execution_policy_changed',null,null,jsonb_build_object('mode',new.mode,'reason',new.reason,'authorized_at',new.authorized_at,'expires_at',new.expires_at));
 end if;return new;
end; $$;
create trigger audit_job_execution_policy after update on private.job_execution_policies for each row execute function private.audit_job_execution_policy();
-- Existing jobs retain their snapshot; initialization does not invent past notifications/audits.
insert into private.job_execution_policies(job_id)select id from public.jobs on conflict do nothing;

drop trigger immutable_job on public.jobs;
create function private.guard_job_contract()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 if (new.id,new.service_request_id,new.quote_id,new.customer_id,new.technician_id,new.snapshot,new.created_at,new.payment_state)
 is distinct from(old.id,old.service_request_id,old.quote_id,old.customer_id,old.technician_id,old.snapshot,old.created_at,old.payment_state)
 then raise exception 'Contrato y estado financiero inmutables' using errcode='PT409'; end if;
 if new.revision<>old.revision+1 then raise exception 'Versión inválida' using errcode='PT409'; end if;
 new.updated_at:=now();return new;
end; $$;
create trigger immutable_job before update on public.jobs for each row execute function private.guard_job_contract();

create function public.job_detail(job_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare j public.jobs; info jsonb; can_private boolean;
begin
 select * into j from public.jobs where id=job_id;if not found or not private.job_can_read(j) then return null; end if;
 can_private:=auth.uid()=j.customer_id or private.is_admin() or private.active_technician_id()=j.technician_id;
 select jsonb_build_object('job',to_jsonb(j),'title',r.title,'commune',r.location_label,
 'customer_name',(select full_name from public.profiles where id=j.customer_id),
 'technician_name',(select full_name from public.profiles where id=j.technician_id),
 'address',case when can_private then d.address else null end,'reference',case when can_private then d.reference else null end,
 'can_operate',private.job_can_operate(j),'can_view_private',can_private,'is_administrator',private.is_admin(),
 'execution_mode',(select p.mode from private.job_execution_policies p where p.job_id=j.id),
 'execution_enabled',private.job_execution_allowed(j.id),
 'schedules',coalesce((select jsonb_agg(to_jsonb(s) order by created_at,id) from private.job_schedule_proposals s where s.job_id=j.id),'[]'),
 'cancellations',coalesce((select jsonb_agg(to_jsonb(c) order by created_at,id) from private.job_cancellations c where c.job_id=j.id),'[]'),
 'incidents',coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object('messages',coalesce((select jsonb_agg(to_jsonb(m) order by created_at,id) from private.job_incident_messages m where m.incident_id=i.id),'[]'),
 'attachments',case when can_private then coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'actor_id',a.actor_id)) from private.job_incident_attachments a where a.incident_id=i.id),'[]') else '[]'::jsonb end) order by i.created_at,i.id) from private.job_incidents i where i.job_id=j.id),'[]'),
 'history',coalesce((select jsonb_agg(to_jsonb(e) order by created_at,id)from private.job_events e where e.job_id=j.id),'[]'),
 'notifications',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'event',o.template,'state',o.state,'created_at',o.created_at) order by o.created_at,o.id)from private.notification_outbox o join private.job_events e on e.id=o.event_id where e.job_id=j.id and o.recipient_id=auth.uid()),'[]')) into info
 from public.service_requests r left join private.service_request_details d on d.request_id=r.id where r.id=j.service_request_id;
 return info;
end; $$;
create function public.job_list(page_number integer default 1,state_filter text default null)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare actor uuid;
begin
 actor:=private.marketplace_actor();if page_number not between 1 and 10000 then raise exception 'Página inválida'using errcode='22023';end if;
 return jsonb_build_object('total',(select count(*)from public.jobs j where private.job_can_read(j) and(state_filter is null or j.status=state_filter)),
 'items',coalesce((select jsonb_agg(to_jsonb(x) order by created_at desc,id)from(
 select j.*,r.title,r.location_label,(select full_name from public.profiles where id=j.customer_id)customer_name,
 (select full_name from public.profiles where id=j.technician_id)technician_name,
 exists(select 1 from private.job_incidents i where i.job_id=j.id and state<>'resolved') active_incident,
 exists(select 1 from private.job_cancellations c where c.job_id=j.id and state='pending') cancellation_pending,
 private.job_execution_allowed(j.id) execution_enabled
 from public.jobs j join public.service_requests r on r.id=j.service_request_id where private.job_can_read(j) and(state_filter is null or j.status=state_filter)
 order by j.created_at desc,j.id limit 20 offset(page_number-1)*20)x),'[]'));
end; $$;

create function public.job_command(job_id uuid,operation_id uuid,expected_revision integer,action text,payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare actor uuid; j public.jobs; receipt private.job_operations; previous text; proposal private.job_schedule_proposals;
 incident private.job_incidents;cancellation private.job_cancellations; result jsonb; administrator boolean; keys text[];
 starts timestamptz;ends timestamptz; target uuid; actor_role public.app_role;
begin
 actor:=private.marketplace_actor();
 if operation_id is null or jsonb_typeof(payload) is distinct from 'object' then raise exception 'Operación inválida'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||operation_id::text,71301425));
 perform pg_advisory_xact_lock(71301421);perform pg_advisory_xact_lock(71301422);
 select * into j from public.jobs where id=job_id for update;
 if not found or not private.job_can_read(j) then raise exception 'Trabajo no disponible'using errcode='42501';end if;
 administrator:=private.is_admin();select role into actor_role from public.profiles where id=actor;
 select * into receipt from private.job_operations o where o.actor_id=actor and o.operation_id=job_command.operation_id;
 if found then
 if receipt.job_id<>j.id or receipt.action<>action or receipt.payload<>payload then raise exception 'Reintento incompatible'using errcode='PT409';end if;
 return receipt.response;end if;
 if j.revision is distinct from expected_revision then raise exception 'El trabajo cambió; actualiza su versión'using errcode='PT409';end if;
 keys:=case action when 'propose_schedule' then array['startsAt','endsAt','localDate','startTime','endTime','reason']
 when 'accept_schedule' then array['proposalId'] when 'reject_schedule' then array['proposalId','reason']
 when 'prepare' then '{}'::text[] when 'start' then '{}'::text[] when 'progress' then array['message']
 when 'report_completion' then array['message'] when 'confirm_completion' then '{}'::text[]
 when 'request_cancellation' then array['reason'] when 'resolve_cancellation' then array['cancellationId','decision','reason']
 when 'open_incident' then array['kind','description'] when 'reply_incident' then array['incidentId','message']
 when 'request_information' then array['incidentId','party','message'] when 'add_observation' then array['incidentId','message']
 when 'resolve_incident' then array['incidentId','message'] end;
 if keys is null or payload-keys<>'{}'::jsonb then raise exception 'Acción o campos no permitidos'using errcode='22023';end if;
 previous:=j.status;
 if action in('resolve_cancellation','request_information','add_observation','resolve_incident') then
 perform private.require_administrator();
 if actor in(j.customer_id,j.technician_id)then raise exception 'No puedes resolver tu propio trabajo'using errcode='42501';end if;
 elsif action in('open_incident','reply_incident','request_cancellation') then
 if actor not in(j.customer_id,j.technician_id)then raise exception 'Participación requerida'using errcode='42501';end if;
 else
 if not private.job_can_operate(j)then raise exception 'Operación profesional no habilitada'using errcode='42501';end if;
 if exists(select 1 from private.job_cancellations c where c.job_id=j.id and state='pending')or exists(select 1 from private.job_incidents i where i.job_id=j.id and state<>'resolved')
 then raise exception 'Existe una gestión pendiente; no se puede avanzar'using errcode='PT409';end if;
 end if;
 if action='propose_schedule' then
 if j.status not in('awarded','coordination_pending','date_proposed','scheduled','ready')or j.started_at is not null then raise exception 'No admite cambios de agenda'using errcode='PT409';end if;
 if coalesce(payload->>'startsAt','')!~'(Z|[+-][0-9]{2}:[0-9]{2})$'or coalesce(payload->>'endsAt','')!~'(Z|[+-][0-9]{2}:[0-9]{2})$'then raise exception 'Instantes con zona obligatorios'using errcode='22023';end if;
 starts:=(payload->>'startsAt')::timestamptz;ends:=(payload->>'endsAt')::timestamptz;
 if starts<=now()or starts>now()+interval '1 year'or ends<=starts or ends-starts>interval '12 hours'
 or to_char(starts at time zone 'America/Santiago','YYYY-MM-DD') is distinct from payload->>'localDate'
 or to_char(starts at time zone 'America/Santiago','HH24:MI') is distinct from payload->>'startTime'
 or to_char(ends at time zone 'America/Santiago','YYYY-MM-DD') is distinct from payload->>'localDate'
 or to_char(ends at time zone 'America/Santiago','HH24:MI') is distinct from payload->>'endTime'
 then raise exception 'Franja horaria inválida para America/Santiago'using errcode='22023';end if;
 if (j.confirmed_schedule_id is not null or exists(select 1 from private.job_schedule_proposals where job_schedule_proposals.job_id=j.id))and length(trim(coalesce(payload->>'reason','')))<10 then raise exception 'Explica el cambio de horario'using errcode='22023';end if;
 update private.job_schedule_proposals set state='superseded' where job_schedule_proposals.job_id=j.id and state in('proposed','accepted');
 insert into private.job_schedule_proposals(job_id,actor_id,starts_at,ends_at,reason,version)values(j.id,actor,starts,ends,coalesce(payload->>'reason',''),j.revision+1)returning id into target;
 j.status:='date_proposed';j.confirmed_schedule_id:=null;
 elsif action in('accept_schedule','reject_schedule')then
 select * into proposal from private.job_schedule_proposals s where s.id=(payload->>'proposalId')::uuid and s.job_id=j.id for update;
 if not found or proposal.state<>'proposed'or j.status<>'date_proposed'then raise exception 'Propuesta no vigente'using errcode='PT409';end if;
 if proposal.actor_id=actor then raise exception 'La contraparte debe responder'using errcode='42501';end if;
 if action='accept_schedule'then
 if proposal.starts_at<=now()then raise exception 'Franja vencida'using errcode='PT409';end if;
 update private.job_schedule_proposals set state='accepted',responded_by=actor where id=proposal.id;
 j.status:='scheduled';j.confirmed_schedule_id:=proposal.id;
 else
 if length(trim(coalesce(payload->>'reason','')))not between 10 and 1000 then raise exception 'Motivo obligatorio'using errcode='22023';end if;
 update private.job_schedule_proposals set state='rejected',responded_by=actor,reason=payload->>'reason'where id=proposal.id;j.status:='coordination_pending';end if;target:=proposal.id;
 elsif action in('prepare','start','progress','report_completion')then
 if actor<>j.technician_id or not private.job_execution_allowed(j.id)then raise exception 'Ejecución bloqueada: falta habilitación comercial aprobada'using errcode='42501';end if;
 if action='prepare'and j.status='scheduled'then j.status:='ready';
 elsif action='start'and j.status='ready'then j.status:='in_progress';j.started_at:=now();
 elsif action='progress'and j.status='in_progress'then null;
 elsif action='report_completion'and j.status='in_progress'then j.status:='completion_reported';j.completion_reported_at:=now();
 else raise exception 'Transición de ejecución inválida'using errcode='PT409';end if;
 if action in('progress','report_completion')and length(trim(coalesce(payload->>'message','')))not between 10 and 1000 then raise exception 'Descripción obligatoria'using errcode='22023';end if;
 elsif action='confirm_completion'then
 if actor<>j.customer_id then raise exception 'Confirmación exclusiva del cliente'using errcode='42501';end if;
 if j.status<>'completion_reported'then raise exception 'Finalización aún no informada'using errcode='PT409';end if;
 j.status:='completed';j.customer_confirmed_at:=now();
 elsif action='request_cancellation'then
 if j.status in('completed','cancelled')or exists(select 1 from private.job_cancellations c where c.job_id=j.id and state='pending')then raise exception 'Cancelación no disponible'using errcode='PT409';end if;
 insert into private.job_cancellations(job_id,actor_id,reason,previous_state)values(j.id,actor,payload->>'reason',j.status)returning id into target;
 elsif action='resolve_cancellation'then
 select * into cancellation from private.job_cancellations c where c.id=(payload->>'cancellationId')::uuid and c.job_id=j.id for update;
 if not found or cancellation.state<>'pending'or j.status in('completed','cancelled')then raise exception 'Gestión no vigente'using errcode='PT409';end if;
 if length(trim(coalesce(payload->>'reason','')))not between 10 and 1000 or coalesce(payload->>'decision','')not in('approved','rejected')then raise exception 'Decisión inválida'using errcode='22023';end if;
 -- Sensitive cancellation stays pending until a commercial policy is separately approved.
 if payload->>'decision'='approved'and(j.started_at is not null or j.payment_state<>'not_enabled')then raise exception 'Falta política comercial para esta cancelación'using errcode='42501';end if;
 update private.job_cancellations set state=payload->>'decision',resolved_by=actor,resolution=payload->>'reason',resolved_at=now()where id=cancellation.id;
 if payload->>'decision'='approved'then j.status:='cancelled';update private.job_schedule_proposals set state='cancelled'where job_schedule_proposals.job_id=j.id and state in('proposed','accepted');end if;target:=cancellation.id;
 elsif action='open_incident'then
 if exists(select 1 from private.job_incidents i where i.job_id=j.id and state<>'resolved')then raise exception 'Ya existe un reclamo abierto'using errcode='PT409';end if;
 insert into private.job_incidents(job_id,opened_by,kind,description,previous_job_state)values(j.id,actor,payload->>'kind',payload->>'description',j.status)returning id into target;
 -- Incident and job states stay separate: unresolved incidents block ordinary advancement.
 else
 select * into incident from private.job_incidents i where i.id=(payload->>'incidentId')::uuid and i.job_id=j.id for update;
 if not found or incident.state='resolved'then raise exception 'Reclamo no disponible'using errcode='PT409';end if;
 if length(trim(coalesce(payload->>'message','')))not between 10 and 3000 then raise exception 'Mensaje inválido'using errcode='22023';end if;
 if action='request_information'then
 if coalesce(payload->>'party','')not in('customer','technician')then raise exception 'Parte inválida'using errcode='22023';end if;
 update private.job_incidents set state='waiting_'||(payload->>'party'),updated_at=now()where id=incident.id;
 elsif action='reply_incident'then update private.job_incidents set state='open',updated_at=now()where id=incident.id;
 elsif action='resolve_incident'then update private.job_incidents set state='resolved',resolution=payload->>'message',resolved_by=actor,updated_at=now()where id=incident.id;end if;
 insert into private.job_incident_messages(incident_id,actor_id,body,kind)values(incident.id,actor,payload->>'message',case action when 'reply_incident'then 'response'when 'request_information'then 'information_request'when 'resolve_incident'then 'resolution'else 'observation'end);target:=incident.id;
 end if;
 update public.jobs set status=j.status,confirmed_schedule_id=j.confirmed_schedule_id,started_at=j.started_at,completion_reported_at=j.completion_reported_at,customer_confirmed_at=j.customer_confirmed_at,revision=revision+1 where id=j.id returning * into j;
 perform private.job_emit(j.id,actor,action,previous,j.status,jsonb_strip_nulls(jsonb_build_object('resource_id',target,'note',coalesce(payload->>'message',payload->>'reason'))));
 result:=jsonb_build_object('job_id',j.id,'revision',j.revision,'status',j.status,'resource_id',target);
 insert into private.job_operations(actor_id,operation_id,job_id,action,payload,response)values(actor,operation_id,j.id,action,payload,result);
 return result;
end; $$;

create function public.claim_job_notification()
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare item private.notification_outbox; destination text; target uuid;
begin
 if(auth.jwt()->>'role')is distinct from 'service_role'then raise exception 'Worker requerido'using errcode='42501';end if;
 update private.notification_outbox set state='dead',lease_token=null,lease_until=null,failure_code='attempts_exhausted'where state='leased'and lease_until<now()and attempts>=5;
 select * into item from private.notification_outbox where attempts<5 and((state='pending'and available_at<=now())or(state='leased'and lease_until<now()))order by available_at,id for update skip locked limit 1;
 if not found then return null;end if;
 update private.notification_outbox set state='leased',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes'where id=item.id returning * into item;
 select email into destination from auth.users where id=item.recipient_id;select job_id into target from private.job_events where id=item.event_id;
 return jsonb_build_object('id',item.id,'event_id',item.event_id,'recipient_id',item.recipient_id,'destination',destination,'job_id',target,'template',item.template,'lease_token',item.lease_token,'attempt',item.attempts);
end; $$;
create function public.finish_job_notification(notification_id uuid,lease_token uuid,outcome text,provider_reference text default null)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare item private.notification_outbox;
begin
 if(auth.jwt()->>'role')is distinct from 'service_role'then raise exception 'Worker requerido'using errcode='42501';end if;
 select * into item from private.notification_outbox where id=notification_id for update;
 if item.state in('captured','accepted')and item.lease_token=finish_job_notification.lease_token then return;end if;
 if not found or item.state<>'leased'or item.lease_token is distinct from finish_job_notification.lease_token or item.lease_until<=now()then raise exception 'Lease inválido'using errcode='PT409';end if;
 if outcome in('captured','accepted')then
 update private.notification_outbox set state=outcome,provider_reference=left(finish_job_notification.provider_reference,200),accepted_at=case when outcome='accepted'then now()end,failure_code=null where id=item.id;
 elsif outcome='retry'then update private.notification_outbox set state=case when attempts>=5 then 'dead'else 'pending'end,available_at=now()+make_interval(secs=>least(3600,30*power(2,attempts)::integer)),lease_token=null,lease_until=null,failure_code='provider_unavailable'where id=item.id;
 else raise exception 'Resultado no permitido; accepted no demuestra delivered'using errcode='22023';end if;
end; $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)values('job-incident-evidence','job-incident-evidence',false,4194304,array['image/jpeg']);
create function private.job_evidence_readable(path text)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from private.job_incident_attachments a join private.job_incidents i on i.id=a.incident_id join public.jobs j on j.id=i.job_id
 where a.storage_path=path and private.job_can_read(j)and(auth.uid()=j.customer_id or private.is_admin()or private.active_technician_id()=j.technician_id));
$$;
create policy job_evidence_private on storage.objects for select to authenticated using(bucket_id='job-incident-evidence'and private.job_evidence_readable(name));
create function public.job_register_evidence(incident_id uuid,attachment_id uuid,content_sha256 text,content_size integer)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare j public.jobs;i private.job_incidents;actor uuid;path text;
begin
 actor:=private.marketplace_actor();select * into i from private.job_incidents where id=incident_id;
 if not found then raise exception 'Reclamo no disponible'using errcode='42501';end if;
 perform pg_advisory_xact_lock(71301421);perform pg_advisory_xact_lock(71301422);
 select * into j from public.jobs where id=i.job_id for update;
 select * into strict i from private.job_incidents where id=incident_id for update;
 if not private.job_can_operate(j)or i.state='resolved'then raise exception 'Adjuntos no habilitados'using errcode='42501';end if;
 path:=actor::text||'/'||incident_id::text||'/'||attachment_id::text||'.jpg';
 if exists(select 1 from private.job_incident_attachments a where a.id=attachment_id and a.incident_id=i.id and a.actor_id=actor and a.storage_path=path and a.sha256=content_sha256 and a.byte_size=content_size)then return;end if;
 if(select count(*)from private.job_incident_attachments a where a.incident_id=i.id and actor_id=actor)>=5 or not exists(select 1 from storage.objects where bucket_id='job-incident-evidence'and name=path)then raise exception 'Límite de adjuntos o archivo no disponible'using errcode='22023';end if;
 insert into private.job_incident_attachments(id,incident_id,actor_id,storage_path,sha256,byte_size)values(attachment_id,incident_id,actor,path,content_sha256,content_size);
 update public.jobs set revision=revision+1 where id=j.id;
 perform private.job_emit(j.id,actor,'incident_evidence_added',j.status,j.status,jsonb_build_object('incident_id',incident_id));
end; $$;
create function public.job_evidence(incident_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 perform private.marketplace_actor();return coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'storage_path',a.storage_path))from private.job_incident_attachments a where a.incident_id=job_evidence.incident_id and private.job_evidence_readable(a.storage_path)),'[]');
end; $$;

revoke all on function private.job_can_read(public.jobs),private.job_can_operate(public.jobs),private.job_execution_allowed(uuid),private.job_emit(uuid,uuid,text,text,text,jsonb),private.initialize_job_operations(),private.guard_job_contract(),private.job_evidence_readable(text)from public,anon,authenticated,service_role;
revoke all on function private.audit_job_execution_policy() from public,anon,authenticated,service_role;
grant execute on function private.job_evidence_readable(text)to authenticated;
revoke all on function public.job_detail(uuid),public.job_list(integer,text),public.job_command(uuid,uuid,integer,text,jsonb),public.job_register_evidence(uuid,uuid,text,integer),public.job_evidence(uuid),public.claim_job_notification(),public.finish_job_notification(uuid,uuid,text,text)from public,anon,authenticated,service_role;
grant execute on function public.job_detail(uuid),public.job_list(integer,text),public.job_command(uuid,uuid,integer,text,jsonb),public.job_register_evidence(uuid,uuid,text,integer),public.job_evidence(uuid)to authenticated;
grant execute on function public.claim_job_notification(),public.finish_job_notification(uuid,uuid,text,text)to service_role;
commit;
