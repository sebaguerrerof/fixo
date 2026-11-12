-- Sprint 05 (Flow Sandbox). Local/isolated review only: remote execution requires specific approval.
-- No Flow credentials, network or real charges here. Money-relevant writes only happen through the narrow RPCs below.
begin;
set local lock_timeout='5s'; set local statement_timeout='30s';

-- ---------------------------------------------------------------------------------------------
-- Pricing policy: immutable versions; fee frozen per order. 500 bp = 5 %.
-- ---------------------------------------------------------------------------------------------
create table private.payment_pricing_policies(
 version integer primary key check(version>0),
 fee_basis_points integer not null check(fee_basis_points between 0 and 2000),
 reason text not null check(length(trim(reason)) between 10 and 1000),
 created_by uuid references public.profiles(id),
 created_at timestamptz not null default now()
);
create index payment_pricing_author_idx on private.payment_pricing_policies(created_by);
insert into private.payment_pricing_policies(version,fee_basis_points,reason)values(1,500,'Política inicial aprobada: 5 % sobre el importe cotizado');
-- Version history is immutable even for privileged sessions: a change is always a NEW version (public.payment_policy_set), never an edit.
create function private.payment_policy_append_only()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin raise exception 'El historial de políticas es inmutable' using errcode='PT409'; end; $$;
create trigger payment_policy_append_only before update or delete on private.payment_pricing_policies for each row execute function private.payment_policy_append_only();

-- integer CLP, round half up; no floating point.
create function private.payment_fee_clp(amount bigint,basis_points integer)
returns bigint language sql immutable set search_path=pg_catalog as $$
 select (amount*basis_points+5000)/10000;
$$;

-- ---------------------------------------------------------------------------------------------
-- Extra charges: proposed by the assigned professional, accepted only by the customer.
-- ---------------------------------------------------------------------------------------------
create table private.job_extra_charges(
 id uuid primary key default gen_random_uuid(),
 job_id uuid not null references public.jobs(id) on delete cascade,
 proposed_by uuid not null references public.profiles(id),
 operation_id uuid not null,
 concept text not null check(length(trim(concept)) between 10 and 500),
 amount_clp bigint not null check(amount_clp between 1000 and 50000000),
 state text not null default 'proposed' check(state in('proposed','accepted','rejected','withdrawn')),
 responded_by uuid references public.profiles(id), responded_at timestamptz,
 response_reason text check(response_reason is null or length(response_reason)<=1000),
 created_at timestamptz not null default now(),
 check((state in('accepted','rejected') and responded_by is not null and responded_at is not null) or state in('proposed','withdrawn'))
);
create unique index job_extra_operation_idx on private.job_extra_charges(proposed_by,operation_id);
create index job_extra_charges_job_idx on private.job_extra_charges(job_id,created_at,id);
create index job_extra_charges_proposer_idx on private.job_extra_charges(proposed_by);
create index job_extra_charges_responder_idx on private.job_extra_charges(responded_by);
create function private.guard_extra_charge()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 if tg_op='DELETE' then raise exception 'Adicionales no se eliminan' using errcode='PT409'; end if;
 if (new.id,new.job_id,new.proposed_by,new.operation_id,new.concept,new.amount_clp,new.created_at) is distinct from (old.id,old.job_id,old.proposed_by,old.operation_id,old.concept,old.amount_clp,old.created_at)
 then raise exception 'Condiciones del adicional inmutables' using errcode='PT409'; end if;
 if old.state<>'proposed' then raise exception 'Adicional ya resuelto' using errcode='PT409'; end if;
 return new;
end; $$;
create trigger guard_extra_charge before update or delete on private.job_extra_charges for each row execute function private.guard_extra_charge();

-- ---------------------------------------------------------------------------------------------
-- Orders: one logical obligation per initial job or accepted extra. Terms frozen at creation.
-- ---------------------------------------------------------------------------------------------
create table private.payment_orders(
 id uuid primary key default gen_random_uuid(),
 job_id uuid not null references public.jobs(id) on delete cascade,
 extra_charge_id uuid unique references private.job_extra_charges(id),
 origin text not null check(origin in('initial','extra')),
 customer_id uuid not null references public.profiles(id),
 environment text not null default 'sandbox' check(environment='sandbox'),
 snapshot_sha256 text not null check(snapshot_sha256 ~ '^[0-9a-f]{64}$'),
 professional_amount_clp bigint not null check(professional_amount_clp between 1000 and 50000000),
 fee_basis_points integer not null check(fee_basis_points between 0 and 2000),
 platform_fee_clp bigint not null check(platform_fee_clp>=0),
 total_clp bigint not null,
 policy_version integer not null references private.payment_pricing_policies(version),
 consent_by uuid not null references public.profiles(id), consent_at timestamptz not null default now(),
 status text not null default 'awaiting_payment' check(status in('awaiting_payment','paid','failed','cancelled')),
 paid_attempt_id uuid, paid_at timestamptz,
 flow_cost_clp bigint check(flow_cost_clp is null or flow_cost_clp>=0),
 review_reason text check(review_reason is null or length(review_reason)<=200),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(total_clp=professional_amount_clp+platform_fee_clp),
 check(platform_fee_clp=private.payment_fee_clp(professional_amount_clp,fee_basis_points)),
 check((origin='initial' and extra_charge_id is null) or (origin='extra' and extra_charge_id is not null)),
 check((status='paid')=(paid_at is not null and paid_attempt_id is not null))
);
create unique index payment_one_initial_idx on private.payment_orders(job_id,environment) where origin='initial';
create index payment_orders_job_idx on private.payment_orders(job_id,created_at,id);
create index payment_orders_customer_idx on private.payment_orders(customer_id);
create index payment_orders_policy_idx on private.payment_orders(policy_version);
create index payment_orders_consent_idx on private.payment_orders(consent_by);
create index payment_orders_review_idx on private.payment_orders(updated_at) where review_reason is not null;
create function private.guard_payment_order()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 if tg_op='DELETE' then raise exception 'Órdenes de pago no se eliminan' using errcode='PT409'; end if;
 if (new.id,new.job_id,new.extra_charge_id,new.origin,new.customer_id,new.environment,new.snapshot_sha256,new.professional_amount_clp,new.fee_basis_points,
  new.platform_fee_clp,new.total_clp,new.policy_version,new.consent_by,new.consent_at,new.created_at)
 is distinct from (old.id,old.job_id,old.extra_charge_id,old.origin,old.customer_id,old.environment,old.snapshot_sha256,old.professional_amount_clp,old.fee_basis_points,
  old.platform_fee_clp,old.total_clp,old.policy_version,old.consent_by,old.consent_at,old.created_at)
 then raise exception 'Términos financieros inmutables' using errcode='PT409'; end if;
 if old.status='paid' and (new.status<>'paid' or new.paid_attempt_id is distinct from old.paid_attempt_id or new.paid_at is distinct from old.paid_at)
 then raise exception 'Un pago verificado no retrocede' using errcode='PT409'; end if;
 new.updated_at:=now(); return new;
end; $$;
create trigger guard_payment_order before update or delete on private.payment_orders for each row execute function private.guard_payment_order();

-- ---------------------------------------------------------------------------------------------
-- Attempts: each external attempt has its own commerce reference. Only one may be payable.
-- ---------------------------------------------------------------------------------------------
create table private.payment_attempts(
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references private.payment_orders(id) on delete cascade,
 idempotency_key uuid not null,
 commerce_order text not null unique check(commerce_order ~ '^fixo-sandbox-[0-9a-f-]{36}$'),
 flow_order bigint unique,
 checkout_ciphertext bytea, checkout_key_id text,
 state text not null default 'prepared' check(state in('prepared','creating','pending','reconciliation_required','paid','failed','cancelled','quarantined')),
 error_code text check(error_code is null or length(error_code)<=100),
 check_count integer not null default 0 check(check_count>=0),
 next_check_at timestamptz not null default now(), last_checked_at timestamptz,
 lease_token uuid, lease_until timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(order_id,idempotency_key)
);
create unique index payment_one_payable_attempt_idx on private.payment_attempts(order_id) where state in('prepared','creating','pending','reconciliation_required');
create index payment_attempts_due_idx on private.payment_attempts(next_check_at,id) where state in('creating','pending','reconciliation_required','paid');
create function private.guard_payment_attempt()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 if tg_op='DELETE' then raise exception 'Intentos de pago no se eliminan' using errcode='PT409'; end if;
 if (new.id,new.order_id,new.idempotency_key,new.commerce_order,new.created_at) is distinct from (old.id,old.order_id,old.idempotency_key,old.commerce_order,old.created_at)
 then raise exception 'Identidad del intento inmutable' using errcode='PT409'; end if;
 if old.flow_order is not null and new.flow_order is distinct from old.flow_order then raise exception 'Identidad Flow inmutable' using errcode='PT409'; end if;
 if old.state='paid' and new.state<>'paid' then raise exception 'Estado técnico final' using errcode='PT409'; end if;
 -- failed/cancelled/quarantined may only move to paid: late evidence of a payment must be recordable (order keeps review).
 if old.state in('failed','cancelled','quarantined') and new.state not in(old.state,'paid') then raise exception 'Estado técnico final' using errcode='PT409'; end if;
 new.updated_at:=now(); return new;
end; $$;
create trigger guard_payment_attempt before update or delete on private.payment_attempts for each row execute function private.guard_payment_attempt();

-- ---------------------------------------------------------------------------------------------
-- Verified observations: append-only; one stable provider key per observation.
-- ---------------------------------------------------------------------------------------------
create table private.payment_events(
 id uuid primary key default gen_random_uuid(),
 order_id uuid references private.payment_orders(id),
 attempt_id uuid references private.payment_attempts(id),
 provider_event_key text not null unique check(length(provider_event_key) between 8 and 200),
 flow_order bigint, commerce_order text,
 observed_status integer not null,
 amount_clp bigint, currency text,
 flow_fee_clp bigint check(flow_fee_clp is null or flow_fee_clp>=0),
 validation text not null check(validation in('applied','duplicate_payment','late_payment','stale','pending','mismatch','unknown_identity','unknown_status','incomplete','cost_updated','job_cancelled')),
 provider_observed_at timestamptz, observed_at timestamptz not null default now()
);
create index payment_events_order_idx on private.payment_events(order_id,observed_at,id);
create index payment_events_attempt_idx on private.payment_events(attempt_id);
create function private.payment_events_append_only()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin raise exception 'Eventos financieros append-only' using errcode='PT409'; end; $$;
create trigger payment_events_append_only before update or delete on private.payment_events for each row execute function private.payment_events_append_only();

-- ---------------------------------------------------------------------------------------------
-- Inbox: durable, untrusted callback receipts (token kept only hashed + authenticated ciphertext).
-- ---------------------------------------------------------------------------------------------
create table private.payment_inbox(
 id uuid primary key default gen_random_uuid(),
 token_sha256 text not null unique check(token_sha256 ~ '^[0-9a-f]{64}$'),
 token_ciphertext bytea not null, key_id text not null,
 generation integer not null default 1 check(generation>0), processed_generation integer not null default 0,
 state text not null default 'pending' check(state in('pending','processing','done','quarantined')),
 attempts integer not null default 0 check(attempts>=0), next_attempt_at timestamptz not null default now(),
 lease_token uuid, lease_until timestamptz, quarantine_reason text check(quarantine_reason is null or length(quarantine_reason)<=200),
 first_received_at timestamptz not null default now(), last_received_at timestamptz not null default now()
);
create index payment_inbox_due_idx on private.payment_inbox(next_attempt_at,id) where state in('pending','processing');

do $$ declare item text; begin foreach item in array array['payment_pricing_policies','job_extra_charges','payment_orders','payment_attempts','payment_events','payment_inbox'] loop
 execute format('alter table private.%I enable row level security',item);
 execute format('revoke all on private.%I from public,anon,authenticated,service_role',item);
end loop; end $$;

-- ---------------------------------------------------------------------------------------------
-- jobs.payment_state: controlled projection of the INITIAL payment only.
-- ---------------------------------------------------------------------------------------------
do $$ declare c text; begin
 for c in select conname from pg_constraint where conrelid='public.jobs'::regclass and contype='c' and pg_get_constraintdef(oid) like '%payment_state%' loop
  execute format('alter table public.jobs drop constraint %I',c);
 end loop;
end $$;
alter table public.jobs add constraint jobs_payment_state_check check(payment_state in('not_enabled','payment_pending','paid','payment_failed','payment_review'));


create function private.job_payment_projection(target uuid)
returns text language sql stable security definer set search_path=pg_catalog as $$
 select case when o.id is null then 'not_enabled' when o.review_reason is not null then 'payment_review'
  when o.status='paid' then 'paid' when o.status='awaiting_payment' then 'payment_pending' else 'payment_failed' end
 from (select 1) x left join private.payment_orders o on o.job_id=target and o.origin='initial' and o.environment='sandbox';
$$;
-- The projection is the only value payment_state may take; clients have no UPDATE on jobs anyway.
create or replace function private.guard_job_contract()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 if (new.id,new.service_request_id,new.quote_id,new.customer_id,new.technician_id,new.snapshot,new.created_at)
 is distinct from(old.id,old.service_request_id,old.quote_id,old.customer_id,old.technician_id,old.snapshot,old.created_at)
 then raise exception 'Contrato inmutable' using errcode='PT409'; end if;
 if new.payment_state is distinct from old.payment_state and new.payment_state is distinct from private.job_payment_projection(new.id)
 then raise exception 'Estado financiero sólo por proyección de pagos verificados' using errcode='PT409'; end if;
 if new.revision<>old.revision+1 then raise exception 'Versión inválida' using errcode='PT409'; end if;
 new.updated_at:=now(); return new;
end; $$;
create function private.sync_job_payment_state(target uuid)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare desired text;
begin
 desired:=private.job_payment_projection(target);
 update public.jobs set payment_state=desired,revision=revision+1 where id=target and payment_state is distinct from desired;
end; $$;

-- Provider-origin job events: no human actor is impersonated; linked once to the financial event.
alter table private.job_events alter column actor_id drop not null;
alter table private.job_events add column source text not null default 'user' check(source in('user','provider')),
 add column payment_event_id uuid unique references private.payment_events(id);
alter table private.job_events add constraint job_events_actor_source_check check((source='user' and actor_id is not null) or (source='provider' and actor_id is null and payment_event_id is not null));
create function private.job_emit_provider(target uuid,payment_event uuid,event_name text,event_details jsonb default '{}')
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare result uuid; j public.jobs;
begin
 select * into strict j from public.jobs where id=target;
 insert into private.job_events(job_id,actor_id,action,details,source,payment_event_id)values(target,null,event_name,event_details,'provider',payment_event)
 on conflict(payment_event_id) do nothing returning id into result;
 if result is null then return null; end if;
 insert into private.notification_outbox(event_id,recipient_id,template)select result,x,event_name from unnest(array[j.customer_id,j.technician_id])x on conflict do nothing;
 return result;
end; $$;

-- Execution gate: payment_required needs a superadmin-approved, bounded Sandbox window AND a verified initial payment.
create or replace function private.job_execution_allowed(target uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from private.job_execution_policies e join public.profiles p on p.id=e.approved_by
 where e.job_id=target and p.role='superadmin' and p.account_status='active' and e.authorized_at<=now() and e.expires_at>now()
 and (e.mode='authorized_pilot'
  or (e.mode='payment_required' and exists(select 1 from private.payment_orders o where o.job_id=target and o.origin='initial' and o.environment='sandbox'
      and o.status='paid' and o.review_reason is null))));
$$;
create function private.job_unpaid_extras(target uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from private.job_extra_charges x left join private.payment_orders o on o.extra_charge_id=x.id
 where x.job_id=target and x.state='accepted' and (o.id is null or o.status<>'paid' or o.review_reason is not null));
$$;

-- ---------------------------------------------------------------------------------------------
-- Customer / professional / admin RPCs
-- ---------------------------------------------------------------------------------------------
-- Closing requires every existing obligation settled: accepted extras AND an initial order, if one exists (pilots without orders are unaffected).
create function private.job_open_obligations(target uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select private.job_unpaid_extras(target)
 or exists(select 1 from private.payment_orders o where o.job_id=target and o.origin='initial' and (o.status<>'paid' or o.review_reason is not null));
$$;
create function private.job_settlement_eligible(target uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from public.jobs j where j.id=target and j.status='completed')
 and exists(select 1 from private.payment_orders o where o.job_id=target and o.origin='initial' and o.environment='sandbox' and o.status='paid' and o.review_reason is null)
 and not private.job_unpaid_extras(target)
 and not exists(select 1 from private.job_incidents i where i.job_id=target and i.state<>'resolved')
 and not exists(select 1 from private.job_cancellations c where c.job_id=target and c.state='pending')
 and not exists(select 1 from private.payment_orders o where o.job_id=target and o.review_reason is not null);
$$;
create function private.lock_job_for_payments(target uuid)
returns public.jobs language plpgsql security definer set search_path=pg_catalog as $$
declare j public.jobs;
begin
 perform pg_advisory_xact_lock(71301421);perform pg_advisory_xact_lock(71301422);
 select * into j from public.jobs where id=target for update;
 if not found or not private.job_can_read(j) then raise exception 'Trabajo no disponible' using errcode='42501'; end if;
 return j;
end; $$;

create function private.require_superadmin()
returns uuid language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if not private.is_active_account() or not exists(select 1 from public.profiles where id=auth.uid() and role='superadmin')
 then raise exception 'Operación exclusiva de superadmin' using errcode='42501'; end if;
 return auth.uid();
end; $$;

create function public.payment_policy_current()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare p private.payment_pricing_policies;
begin
 perform private.marketplace_actor();
 select * into strict p from private.payment_pricing_policies order by version desc limit 1;
 return jsonb_build_object('version',p.version,'fee_basis_points',p.fee_basis_points);
end; $$;

create function public.payment_policy_set(expected_version integer,basis_points integer,change_reason text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare actor uuid; current_policy private.payment_pricing_policies;
begin
 actor:=private.require_superadmin();
 if basis_points not between 0 and 2000 or length(trim(coalesce(change_reason,''))) not between 10 and 1000 then raise exception 'Política inválida' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(71301430);
 select * into strict current_policy from private.payment_pricing_policies order by version desc limit 1;
 if current_policy.version<>expected_version then raise exception 'La política cambió; actualiza la versión' using errcode='PT409'; end if;
 insert into private.payment_pricing_policies(version,fee_basis_points,reason,created_by)values(expected_version+1,basis_points,trim(change_reason),actor);
 return jsonb_build_object('version',expected_version+1,'fee_basis_points',basis_points);
end; $$;

-- Customer consents to Q/F/T for the version they saw, then order + first attempt are persisted BEFORE any network call.
create function public.payment_prepare(target_job uuid,target_extra uuid,expected_policy_version integer,consent boolean,idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare actor uuid; j public.jobs; pol private.payment_pricing_policies; o private.payment_orders; x private.job_extra_charges; a private.payment_attempts;
 q bigint; digest text; origin_kind text;
begin
 actor:=private.marketplace_actor('customer');
 if consent is not true or idempotency_key is null or expected_policy_version is null then raise exception 'Consentimiento financiero y versión de política requeridos' using errcode='22023'; end if;
 j:=private.lock_job_for_payments(target_job);
 if actor<>j.customer_id then raise exception 'Pago exclusivo del cliente' using errcode='42501'; end if;
 if j.status in('cancelled','completed','disputed') or exists(select 1 from private.job_cancellations c where c.job_id=j.id and c.state='pending')
  or exists(select 1 from private.job_incidents i where i.job_id=j.id and i.state<>'resolved') then raise exception 'El trabajo no admite pagos ahora' using errcode='PT409'; end if;
 if target_extra is null then
  origin_kind:='initial'; select * into o from private.payment_orders where job_id=j.id and origin='initial' and environment='sandbox' for update;
 else
  origin_kind:='extra'; select * into x from private.job_extra_charges where id=target_extra and job_id=j.id;
  if not found or x.state<>'accepted' then raise exception 'Adicional no aceptado' using errcode='PT409'; end if;
  select * into o from private.payment_orders where extra_charge_id=x.id for update;
 end if;
 if not found then
  select * into strict pol from private.payment_pricing_policies order by version desc limit 1;
  if pol.version is distinct from expected_policy_version then raise exception 'La política cambió; revisa el nuevo desglose' using errcode='PT409'; end if;
  if origin_kind='initial' then
   if (j.snapshot->>'currency') is distinct from 'CLP' or coalesce(j.snapshot->>'priceClp','') !~ '^[0-9]{4,8}$' then raise exception 'Contrato sin importe válido' using errcode='PT409'; end if;
   q:=(j.snapshot->>'priceClp')::bigint; digest:=encode(sha256(convert_to(j.snapshot::text,'UTF8')),'hex');
  else q:=x.amount_clp; digest:=encode(sha256(convert_to(x.id::text||':'||x.concept||':'||x.amount_clp::text,'UTF8')),'hex'); end if;
  insert into private.payment_orders(job_id,extra_charge_id,origin,customer_id,snapshot_sha256,professional_amount_clp,fee_basis_points,platform_fee_clp,total_clp,policy_version,consent_by)
  values(j.id,x.id,origin_kind,actor,digest,q,pol.fee_basis_points,private.payment_fee_clp(q,pol.fee_basis_points),q+private.payment_fee_clp(q,pol.fee_basis_points),pol.version,actor)returning * into o;
 end if;
 if o.status='paid' then raise exception 'La obligación ya está pagada' using errcode='PT409'; end if;
 if o.status<>'awaiting_payment' then raise exception 'La obligación no admite pago' using errcode='PT409'; end if;
 -- The consent covers the exact Q/F/T the customer saw. An order frozen under another policy version (e.g. created from another tab after a
 -- fee change) must never be paid or reopened under this consent: the customer refreshes the breakdown and consents again.
 if o.policy_version is distinct from expected_policy_version then raise exception 'El desglose cambió; actualiza la página y confirma nuevamente' using errcode='PT409'; end if;
 select * into a from private.payment_attempts where order_id=o.id and payment_attempts.idempotency_key=payment_prepare.idempotency_key;
 if not found then
  if o.review_reason is not null then raise exception 'La obligación está en revisión; no se crean nuevos intentos' using errcode='PT409'; end if;
  -- Lost response / new tab / new key: reuse the not-yet-sent attempt of this obligation; never create a second charge.
  select * into a from private.payment_attempts p where p.order_id=o.id and p.state='prepared' for update;
  if not found then
   -- Same customer reopening (closed tab, other device): reuse the live checkout of the single payable attempt; never create another charge.
   select * into a from private.payment_attempts p where p.order_id=o.id and p.state='pending';
   if not found then
    if exists(select 1 from private.payment_attempts p where p.order_id=o.id and p.state in('creating','reconciliation_required','quarantined'))then
     raise exception 'Ya existe un intento en curso; verifica su estado antes de reintentar' using errcode='PT409'; end if;
    a.id:=gen_random_uuid();
    insert into private.payment_attempts(id,order_id,idempotency_key,commerce_order)values(a.id,o.id,idempotency_key,'fixo-sandbox-'||a.id)returning * into a;
   end if;
  end if;
 end if;
 perform private.sync_job_payment_state(j.id);
 return jsonb_build_object('order_id',o.id,'attempt_id',a.id,'commerce_order',a.commerce_order,'attempt_state',a.state,'professional_amount_clp',o.professional_amount_clp,
  'platform_fee_clp',o.platform_fee_clp,'total_clp',o.total_clp,'policy_version',o.policy_version,'amount_clp',o.total_clp);
end; $$;

create function public.job_extra_propose(target_job uuid,operation_id uuid,concept_text text,amount bigint)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare actor uuid; j public.jobs; x private.job_extra_charges; clean text;
begin
 actor:=private.marketplace_actor('technician');
 if operation_id is null then raise exception 'Operación inválida' using errcode='22023'; end if;
 j:=private.lock_job_for_payments(target_job);
 if actor<>j.technician_id or private.active_technician_id() is distinct from actor then raise exception 'Sólo el profesional asignado vigente' using errcode='42501'; end if;
 clean:=trim(coalesce(concept_text,''));
 -- Idempotent replay (same actor + operation + payload) returns the first result; other payloads conflict.
 select * into x from private.job_extra_charges e where e.proposed_by=actor and e.operation_id=job_extra_propose.operation_id;
 if found then
  if x.job_id<>j.id or x.concept<>clean or x.amount_clp is distinct from amount then raise exception 'Reintento incompatible' using errcode='PT409'; end if;
  return jsonb_build_object('id',x.id,'state',x.state);
 end if;
 if j.status not in('scheduled','ready','in_progress','completion_reported') or j.payment_state<>'paid' then raise exception 'El trabajo no admite adicionales ahora' using errcode='PT409'; end if;
 if(select count(*)from private.job_extra_charges where job_id=j.id and state='proposed')>=3 then raise exception 'Demasiadas propuestas pendientes' using errcode='PT409'; end if;
 insert into private.job_extra_charges(job_id,proposed_by,operation_id,concept,amount_clp)values(j.id,actor,operation_id,clean,amount)returning * into x;
 update public.jobs set revision=revision+1 where id=j.id;
 perform private.job_emit(j.id,actor,'extra_charge_proposed',j.status,j.status,jsonb_build_object('resource_id',x.id));
 return jsonb_build_object('id',x.id,'state',x.state);
end; $$;

-- Customer accepts after seeing Q/F/T for the shown policy version; acceptance creates the frozen obligation.
create function public.job_extra_respond(target_extra uuid,decision text,expected_policy_version integer,reason_text text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare actor uuid; x private.job_extra_charges; j public.jobs; pol private.payment_pricing_policies; fee bigint; o private.payment_orders;
begin
 actor:=private.marketplace_actor('customer');
 select * into x from private.job_extra_charges where id=target_extra;
 if not found then raise exception 'Adicional no disponible' using errcode='42501'; end if;
 j:=private.lock_job_for_payments(x.job_id);
 select * into x from private.job_extra_charges where id=target_extra for update;
 if actor<>j.customer_id then raise exception 'Respuesta exclusiva del cliente' using errcode='42501'; end if;
 if decision not in('accepted','rejected') or (decision='accepted' and expected_policy_version is null) then raise exception 'Decisión o versión de política inválida' using errcode='22023'; end if;
 if x.state<>'proposed' then raise exception 'Adicional ya resuelto' using errcode='PT409'; end if;
 if j.status not in('scheduled','ready','in_progress','completion_reported') then raise exception 'El trabajo ya no admite adicionales' using errcode='PT409'; end if;
 if decision='accepted' then
  select * into strict pol from private.payment_pricing_policies order by version desc limit 1;
  if pol.version is distinct from expected_policy_version then raise exception 'La política cambió; revisa el nuevo desglose' using errcode='PT409'; end if;
  fee:=private.payment_fee_clp(x.amount_clp,pol.fee_basis_points);
 end if;
 update private.job_extra_charges set state=decision,responded_by=actor,responded_at=now(),response_reason=left(reason_text,1000)where id=x.id;
 if decision='accepted' then
  insert into private.payment_orders(job_id,extra_charge_id,origin,customer_id,snapshot_sha256,professional_amount_clp,fee_basis_points,platform_fee_clp,total_clp,policy_version,consent_by)
  values(j.id,x.id,'extra',actor,encode(sha256(convert_to(x.id::text||':'||x.concept||':'||x.amount_clp::text,'UTF8')),'hex'),x.amount_clp,pol.fee_basis_points,fee,x.amount_clp+fee,pol.version,actor)returning * into o;
 end if;
 update public.jobs set revision=revision+1 where id=j.id;
 perform private.job_emit(j.id,actor,case decision when 'accepted' then 'extra_charge_accepted' else 'extra_charge_rejected' end,j.status,j.status,jsonb_build_object('resource_id',x.id));
 return jsonb_build_object('id',x.id,'state',decision,'order_id',o.id);
end; $$;

-- Role-aware read model. Technicians never see customer-side fee detail as "payout"; they see assigned Q only.
create function public.job_payments(target_job uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare j public.jobs; viewer uuid; is_customer boolean; is_tech boolean; admin boolean;
begin
 viewer:=private.marketplace_actor(); select * into j from public.jobs where id=target_job;
 if not found or not private.job_can_read(j) then return null; end if;
 is_customer:=viewer=j.customer_id; is_tech:=viewer=j.technician_id; admin:=private.is_admin();
 return jsonb_build_object('job_id',j.id,'payment_state',j.payment_state,'environment','sandbox',
 'policy',(select jsonb_build_object('version',p.version,'fee_basis_points',p.fee_basis_points)from private.payment_pricing_policies p order by version desc limit 1),
 'unpaid_extras',private.job_unpaid_extras(j.id),
 'orders',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'origin',o.origin,'extra_charge_id',o.extra_charge_id,'status',o.status,'review',o.review_reason is not null,
   'professional_amount_clp',o.professional_amount_clp,'policy_version',o.policy_version,
   'platform_fee_clp',case when is_tech then null else o.platform_fee_clp end,'total_clp',case when is_tech then null else o.total_clp end,
   'paid_at',o.paid_at,'created_at',o.created_at,
   'latest_attempt_state',(select a.state from private.payment_attempts a where a.order_id=o.id order by a.created_at desc,a.id limit 1),
   'latest_attempt_id',case when is_customer or admin then (select a.id from private.payment_attempts a where a.order_id=o.id order by a.created_at desc,a.id limit 1) end,
   'flow_cost_clp',case when admin then o.flow_cost_clp end,'review_reason',case when admin then o.review_reason end,
   'margin_status',case when admin then case when o.flow_cost_clp is null then 'pending_reconciliation' else 'confirmed' end end,
   'platform_margin_clp',case when admin and o.flow_cost_clp is not null then o.platform_fee_clp-o.flow_cost_clp end,
   'simulated_settlement_clp',case when o.status='paid' and private.job_settlement_eligible(j.id) then o.professional_amount_clp end) order by o.created_at,o.id)
   from private.payment_orders o where o.job_id=j.id and(is_customer or is_tech or admin)),'[]'),
 'extras',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'concept',x.concept,'amount_clp',x.amount_clp,'state',x.state,'created_at',x.created_at)order by x.created_at,x.id)
   from private.job_extra_charges x where x.job_id=j.id),'[]'));
end; $$;

-- Superadmin: schedule a re-check only. It can never impose "paid".
create function public.payment_request_reconciliation(target_attempt uuid)
returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
 perform private.require_superadmin();
 -- Only schedules a provider query. For an already paid attempt it can ONLY re-check the missing Flow cost; payment is never touched.
 update private.payment_attempts t set next_check_at=now(),lease_token=null,lease_until=null,check_count=case when t.state='paid' then 0 else t.check_count end
 from private.payment_orders o where o.id=t.order_id and t.id=target_attempt
 and(t.state in('creating','pending','reconciliation_required')or(t.state='paid' and o.paid_attempt_id=t.id and o.flow_cost_clp is null));
 if not found then raise exception 'Intento sin consulta pendiente' using errcode='PT409'; end if;
end; $$;

create function public.payment_admin_overview()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 perform private.require_administrator();
 return jsonb_build_object('policy',(select jsonb_build_object('version',p.version,'fee_basis_points',p.fee_basis_points,'reason',p.reason,'created_at',p.created_at)from private.payment_pricing_policies p order by version desc limit 1),
 'history',coalesce((select jsonb_agg(jsonb_build_object('version',h.version,'fee_basis_points',h.fee_basis_points,'reason',h.reason,'created_at',h.created_at,
  'author_name',(select pr.full_name from public.profiles pr where pr.id=h.created_by))order by h.version desc)
  from(select * from private.payment_pricing_policies order by version desc limit 10)h),'[]'),
 'pending',coalesce((select jsonb_agg(jsonb_build_object('attempt_id',a.id,'order_id',a.order_id,'job_id',o.job_id,'state',a.state,'cost_pending',(a.state='paid'),'exhausted',(a.state='paid' and a.check_count>=10),'last_checked_at',a.last_checked_at,'next_check_at',a.next_check_at,'check_count',a.check_count,'error_code',a.error_code)order by a.created_at)
  from private.payment_attempts a join private.payment_orders o on o.id=a.order_id where a.state in('creating','pending','reconciliation_required','quarantined') or(a.state='paid' and o.paid_attempt_id=a.id and o.flow_cost_clp is null)),'[]'),
 'reviews',coalesce((select jsonb_agg(jsonb_build_object('order_id',o.id,'job_id',o.job_id,'reason',o.review_reason,'status',o.status,'updated_at',o.updated_at)order by o.updated_at)
  from private.payment_orders o where o.review_reason is not null),'[]'),
 'quarantined_inbox',(select count(*)from private.payment_inbox where state='quarantined'));
end; $$;

-- Superadmin explicitly opens a bounded Sandbox window for ONE job; never a global switch.
create function public.payment_enable_sandbox_job(target_job uuid,window_hours integer,approval_reason text)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare actor uuid;
begin
 actor:=private.require_superadmin();
 if window_hours not between 1 and 720 or length(trim(coalesce(approval_reason,''))) not between 10 and 1000 then raise exception 'Habilitación inválida' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(71301421);perform pg_advisory_xact_lock(71301422);
 if not exists(select 1 from public.jobs where id=target_job for update) then raise exception 'Trabajo no disponible' using errcode='42501'; end if;
 update private.job_execution_policies set mode='payment_required',approved_by=actor,reason=trim(approval_reason),authorized_at=now(),expires_at=now()+make_interval(hours=>window_hours)
 where job_id=target_job and mode<>'authorized_pilot';
end; $$;

-- ---------------------------------------------------------------------------------------------
-- Worker / server-only RPCs (service_role). None can insert a verified payment without a provider observation.
-- ---------------------------------------------------------------------------------------------
create function private.require_service_role()
returns void language plpgsql stable set search_path=pg_catalog as $$
begin if(auth.jwt()->>'role')is distinct from 'service_role'then raise exception 'Worker requerido' using errcode='42501';end if; end; $$;

create function public.payment_attempt_begin_create(target_attempt uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare a private.payment_attempts; o private.payment_orders; j public.jobs; job_ref uuid;
begin
 perform private.require_service_role();
 select o2.job_id into job_ref from private.payment_attempts a2 join private.payment_orders o2 on o2.id=a2.order_id where a2.id=target_attempt;
 if job_ref is null then raise exception 'Intento no creable' using errcode='PT409'; end if;
 perform pg_advisory_xact_lock(71301421);perform pg_advisory_xact_lock(71301422);
 select * into j from public.jobs where id=job_ref for update;
 select * into a from private.payment_attempts where id=target_attempt for update;
 select * into o from private.payment_orders where id=a.order_id for update;
 if a.state<>'prepared' then raise exception 'Intento no creable' using errcode='PT409'; end if;
 -- Re-check before ANY external call: obligation still collectable, not under review, job still admits charging.
 if o.status<>'awaiting_payment' or o.review_reason is not null or j.status in('cancelled','completed','disputed')
  or exists(select 1 from private.job_cancellations c where c.job_id=j.id and c.state='pending')
  or exists(select 1 from private.job_incidents i where i.job_id=j.id and i.state<>'resolved')
  or exists(select 1 from public.profiles p where p.id in(o.customer_id,j.technician_id) and p.account_status<>'active')
 then raise exception 'La obligación ya no admite cobro' using errcode='PT409'; end if;
 update private.payment_attempts set state='creating',next_check_at=now()+interval '2 minutes',check_count=0 where id=a.id;
 return jsonb_build_object('attempt_id',a.id,'commerce_order',a.commerce_order,'amount_clp',o.total_clp,'currency','CLP','order_id',o.id,'customer_id',o.customer_id);
end; $$;
create function public.payment_attempt_set_checkout(target_attempt uuid,flow_order_id bigint,ciphertext bytea,key_id text)
returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
 perform private.require_service_role();
 -- Idempotent for the same Flow identity: a reconciliation may already have recorded flow_order (never overwritten with another one).
 update private.payment_attempts set state='pending',flow_order=flow_order_id,checkout_ciphertext=ciphertext,checkout_key_id=key_id,error_code=null,next_check_at=now()+interval '2 minutes'
 where id=target_attempt and state in('creating','reconciliation_required') and checkout_ciphertext is null and(flow_order is null or flow_order=flow_order_id);
 if not found then raise exception 'Intento no actualizable' using errcode='PT409'; end if;
end; $$;
-- Reopen an existing checkout: only for the owning customer, a still-payable pending attempt on an obligation without review.
create function public.payment_attempt_checkout(target_attempt uuid,expected_customer uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare a private.payment_attempts; o private.payment_orders; j public.jobs;
begin
 perform private.require_service_role();
 select * into a from private.payment_attempts where id=target_attempt;
 if found then select * into o from private.payment_orders where id=a.order_id; select * into j from public.jobs where id=o.job_id; end if;
 if not found or expected_customer is null or o.customer_id is distinct from expected_customer or a.state<>'pending' or a.checkout_ciphertext is null
  or o.status<>'awaiting_payment' or o.review_reason is not null or j.status in('cancelled','completed','disputed')
  or exists(select 1 from private.job_cancellations c where c.job_id=j.id and c.state='pending')
  or exists(select 1 from public.profiles p where p.id in(o.customer_id,j.technician_id) and p.account_status<>'active')
 then raise exception 'Checkout no disponible' using errcode='PT409'; end if;
 return jsonb_build_object('key_id',a.checkout_key_id,'ciphertext',encode(a.checkout_ciphertext,'hex'));
end; $$;
-- Timeout/lost response/failed persistence: ambiguous, NEVER recreate automatically.
-- A 'pending' attempt always has its persisted checkout, so there is nothing ambiguous left: it is never degraded (a late error report must not undo a committed set_checkout).
create function public.payment_attempt_mark_ambiguous(target_attempt uuid,code text)
returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
 perform private.require_service_role();
 update private.payment_attempts set state='reconciliation_required',error_code=left(code,100),next_check_at=now()+interval '1 minute' where id=target_attempt and state in('creating','reconciliation_required');
end; $$;
-- Definitive provider refusal before any Flow identity exists (e.g. 4xx validation): safe to close.
create function public.payment_attempt_mark_failed(target_attempt uuid,code text)
returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
 perform private.require_service_role();
 update private.payment_attempts set state='failed',error_code=left(code,100) where id=target_attempt and state in('prepared','creating') and flow_order is null;
 if not found then raise exception 'Intento no cerrable' using errcode='PT409'; end if;
end; $$;

create function public.payment_inbox_receive(token_hash text,ciphertext bytea,key_id text)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare result uuid;
begin
 perform private.require_service_role();
 insert into private.payment_inbox(token_sha256,token_ciphertext,key_id)values(token_hash,ciphertext,key_id)
 on conflict(token_sha256)do update set generation=private.payment_inbox.generation+1,last_received_at=now(),
  state=case when private.payment_inbox.state in('quarantined','processing') then private.payment_inbox.state else 'pending' end,
  next_attempt_at=case when private.payment_inbox.state='processing' then private.payment_inbox.next_attempt_at else now() end
 returning id into result;
 return result;
end; $$;
create function public.payment_inbox_claim()
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare i private.payment_inbox;
begin
 perform private.require_service_role();
 select * into i from private.payment_inbox where(state='pending' and next_attempt_at<=now())or(state='processing' and lease_until<now())order by next_attempt_at,id for update skip locked limit 1;
 if not found then return null; end if;
 update private.payment_inbox set state='processing',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes' where id=i.id returning * into i;
 return jsonb_build_object('id',i.id,'token_ciphertext',encode(i.token_ciphertext,'base64'),'token_sha256',i.token_sha256,'key_id',i.key_id,'generation',i.generation,'lease_token',i.lease_token,'attempt',i.attempts);
end; $$;
create function public.payment_inbox_finish(inbox_id uuid,lease uuid,outcome text,observed_generation integer,reason text default null)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare i private.payment_inbox;
begin
 perform private.require_service_role();
 select * into i from private.payment_inbox where id=inbox_id for update;
 if not found or i.state<>'processing' or i.lease_token is distinct from lease or i.lease_until<=now() then raise exception 'Lease inválido' using errcode='PT409'; end if;
 if outcome='done' then
  -- A newer notification for the same token arrived while processing: keep it pending.
  update private.payment_inbox set processed_generation=observed_generation,state=case when generation>observed_generation then 'pending' else 'done' end,lease_token=null,lease_until=null,next_attempt_at=now() where id=i.id;
 elsif outcome='retry' then
  update private.payment_inbox set state='pending',lease_token=null,lease_until=null,next_attempt_at=now()+make_interval(secs=>least(3600,30*power(2,least(attempts,7))::integer))where id=i.id;
 elsif outcome='quarantine' then
  update private.payment_inbox set state='quarantined',lease_token=null,lease_until=null,quarantine_reason=left(reason,200) where id=i.id;
 else raise exception 'Resultado no permitido' using errcode='22023'; end if;
end; $$;
create function public.payment_attempt_claim_due()
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare a private.payment_attempts;
begin
 perform private.require_service_role();
 select t.* into a from private.payment_attempts t join private.payment_orders o on o.id=t.order_id
 where t.next_check_at<=now()and(t.lease_until is null or t.lease_until<now())
 and(t.state in('creating','pending','reconciliation_required')or(t.state='paid' and o.paid_attempt_id=t.id and o.flow_cost_clp is null and t.check_count<10))
 order by t.next_check_at,t.id for update of t skip locked limit 1;
 if not found then return null; end if;
 update private.payment_attempts set lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes',check_count=check_count+1 where id=a.id returning * into a;
 return jsonb_build_object('attempt_id',a.id,'commerce_order',a.commerce_order,'flow_order',a.flow_order,'lease_token',a.lease_token,'check_count',a.check_count,'state',a.state);
end; $$;
create function public.payment_attempt_release(target_attempt uuid,lease uuid,delay_seconds integer,code text default null)
returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
 perform private.require_service_role();
 update private.payment_attempts set lease_token=null,lease_until=null,last_checked_at=now(),error_code=left(code,100),
  next_check_at=now()+make_interval(secs=>least(3600,greatest(30,delay_seconds)))where id=target_attempt and lease_token=lease;
 if not found then raise exception 'Lease inválido' using errcode='PT409'; end if;
end; $$;

-- Resolve which attempt a verified provider response belongs to (by identity persisted by Fixo only).
create function public.payment_attempt_lookup(by_commerce_order text,by_flow_order bigint)
returns uuid language plpgsql stable security definer set search_path=pg_catalog as $$
declare result uuid;
begin
 perform private.require_service_role();
 select id into result from private.payment_attempts where(by_commerce_order is not null and commerce_order=by_commerce_order)or(by_flow_order is not null and flow_order=by_flow_order)
 order by (commerce_order=by_commerce_order) desc limit 1;
 return result;
end; $$;

-- Applies ONE verified provider observation atomically: event + order + projection + outbox, deduplicated, no network.
create function public.payment_apply_observation(target_attempt uuid,event_key text,observed_flow_order bigint,observed_commerce_order text,
 observed_status integer,observed_amount bigint,observed_currency text,observed_fee bigint,provider_time timestamptz)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare a private.payment_attempts; o private.payment_orders; j public.jobs; ev uuid; verdict text; job_ref uuid; suspended boolean; late_reason text;
begin
 perform private.require_service_role();
 if target_attempt is null then
  insert into private.payment_events(provider_event_key,flow_order,commerce_order,observed_status,amount_clp,currency,validation,provider_observed_at)
  values(event_key,observed_flow_order,observed_commerce_order,observed_status,observed_amount,observed_currency,'unknown_identity',provider_time)on conflict do nothing;
  return jsonb_build_object('result','quarantined','validation','unknown_identity');
 end if;
 select o2.job_id into job_ref from private.payment_attempts a2 join private.payment_orders o2 on o2.id=a2.order_id where a2.id=target_attempt;
 if job_ref is null then raise exception 'Intento desconocido' using errcode='PT409'; end if;
 perform pg_advisory_xact_lock(71301421);perform pg_advisory_xact_lock(71301422);
 select * into j from public.jobs where id=job_ref for update;
 select * into a from private.payment_attempts where id=target_attempt for update;
 select * into o from private.payment_orders where id=a.order_id for update;
 -- A response without a valid Flow identity has NO financial effect (recorded only).
 if observed_flow_order is null or observed_flow_order<=0 then
  insert into private.payment_events(order_id,attempt_id,provider_event_key,flow_order,commerce_order,observed_status,amount_clp,currency,validation,provider_observed_at)
  values(o.id,a.id,event_key,null,observed_commerce_order,coalesce(observed_status,0),observed_amount,observed_currency,'incomplete',provider_time)on conflict do nothing;
  return jsonb_build_object('result','ignored','validation','incomplete');
 end if;
 -- Correlation: reference, account/environment (sandbox only), currency and EXACT total.
 if a.commerce_order is distinct from observed_commerce_order or (a.flow_order is not null and a.flow_order is distinct from observed_flow_order)
  or observed_currency is distinct from 'CLP' or observed_amount is distinct from o.total_clp then
  insert into private.payment_events(order_id,attempt_id,provider_event_key,flow_order,commerce_order,observed_status,amount_clp,currency,validation,provider_observed_at)
  values(o.id,a.id,event_key,observed_flow_order,observed_commerce_order,observed_status,observed_amount,observed_currency,'mismatch',provider_time)on conflict do nothing returning id into ev;
  if ev is not null then
   update private.payment_orders set review_reason='provider_mismatch' where id=o.id and review_reason is null;
   update private.payment_attempts set state='quarantined' where id=a.id and state in('prepared','creating','pending','reconciliation_required');
   perform private.sync_job_payment_state(j.id);
  end if;
  return jsonb_build_object('result','quarantined','validation','mismatch');
 end if;
 if observed_status not in(1,2,3,4) then
  insert into private.payment_events(order_id,attempt_id,provider_event_key,flow_order,commerce_order,observed_status,amount_clp,currency,validation,provider_observed_at)
  values(o.id,a.id,event_key,observed_flow_order,observed_commerce_order,observed_status,observed_amount,observed_currency,'unknown_status',provider_time)on conflict do nothing;
  return jsonb_build_object('result','ignored','validation','unknown_status');
 end if;
 suspended:=exists(select 1 from public.profiles p where p.id in(o.customer_id,j.technician_id) and p.account_status<>'active');
 late_reason:=case when j.status in('cancelled','disputed') or a.state in('failed','cancelled','quarantined') then 'late_payment'
  when exists(select 1 from private.job_cancellations c where c.job_id=j.id and c.state='pending') then 'cancellation_pending'
  when suspended then 'participant_suspended' else null end;
 verdict:=case observed_status
  when 1 then 'pending'
  when 2 then case when o.status='paid' and(o.paid_attempt_id=a.id or a.state='paid')then 'stale' when o.status='paid' then 'duplicate_payment'
   when late_reason is not null then 'late_payment' else 'applied' end
  else case when a.state in('paid','failed','cancelled','quarantined') then 'stale' else 'applied' end end;
 -- A rejection/annulment never reverts a verified payment ('stale'), but closes a still-open attempt.
 insert into private.payment_events(order_id,attempt_id,provider_event_key,flow_order,commerce_order,observed_status,amount_clp,currency,flow_fee_clp,validation,provider_observed_at)
 values(o.id,a.id,event_key,observed_flow_order,observed_commerce_order,observed_status,observed_amount,observed_currency,observed_fee,verdict,provider_time)
 on conflict(provider_event_key)do nothing returning id into ev;
 if ev is null then
  -- Deduplicated observation: no financial effect, but a persisted checkout stuck in reconciliation is recovered idempotently (lost/late persistence response).
  if observed_status=1 then update private.payment_attempts set state='pending',error_code=null where id=a.id and state='reconciliation_required' and checkout_ciphertext is not null and flow_order is not distinct from observed_flow_order; end if;
  return jsonb_build_object('result','duplicate');
 end if;
 if verdict='stale' and observed_status=2 then
  -- Same verified payment seen again: it may only complete the previously unknown Flow cost (no new assignment/notice).
  -- Only the attempt that paid the order may complete its cost; a duplicate external payment never feeds the order cost.
  if o.paid_attempt_id=a.id and o.flow_cost_clp is null and observed_fee is not null then
   update private.payment_orders set flow_cost_clp=observed_fee where id=o.id;
   return jsonb_build_object('result','cost_updated');
  end if;
  return jsonb_build_object('result','stale');
 end if;
 if verdict='pending' then
  -- Provider state is recorded, but the attempt only becomes 'pending' (reopenable) through set_checkout: a pending attempt always has its checkout.
  -- Without a stored checkout it stays in reconciliation_required with an explicit code (the token was not persisted; no new charge is created).
  update private.payment_attempts set flow_order=coalesce(flow_order,observed_flow_order),
   state=case when state='creating' and checkout_ciphertext is null then state when state in('creating','reconciliation_required') and checkout_ciphertext is null then 'reconciliation_required' when state in('creating','reconciliation_required') then 'pending' else state end,
   error_code=case when state='reconciliation_required' and checkout_ciphertext is null then 'checkout_not_persisted' else error_code end where id=a.id;
  return jsonb_build_object('result','pending');
 end if;
 if verdict='stale' then return jsonb_build_object('result','stale'); end if;
 if observed_status in(3,4) then
  update private.payment_attempts set flow_order=coalesce(flow_order,observed_flow_order),state=case observed_status when 3 then 'failed' else 'cancelled' end,lease_token=null,lease_until=null where id=a.id;
  -- The old attempt is now final. If the order is already paid (another attempt), the verified payment is untouched: no notice, no projection change.
  if o.status<>'paid' then
   perform private.job_emit_provider(j.id,ev,case observed_status when 3 then 'payment_rejected' else 'payment_cancelled' end,jsonb_build_object('order_id',o.id));
   perform private.sync_job_payment_state(j.id);
  end if;
  return jsonb_build_object('result',case observed_status when 3 then 'failed' else 'cancelled' end);
 end if;
 if verdict in('applied','late_payment') then
  update private.payment_orders set status='paid',paid_attempt_id=a.id,paid_at=now(),flow_cost_clp=observed_fee,
   review_reason=case when verdict='late_payment' then coalesce(review_reason,late_reason) else review_reason end where id=o.id;
  update private.payment_attempts set state='paid',flow_order=coalesce(flow_order,observed_flow_order),lease_token=null,lease_until=null,check_count=0,
   next_check_at=case when observed_fee is null then now()+interval '10 minutes' else next_check_at end where id=a.id;
  update private.payment_attempts set state='cancelled',error_code='order_paid' where order_id=o.id and id<>a.id and state='prepared';
  perform private.job_emit_provider(j.id,ev,case when verdict='late_payment' then 'payment_review_required' else 'payment_confirmed' end,jsonb_build_object('order_id',o.id));
 elsif verdict='duplicate_payment' then
  update private.payment_orders set review_reason='duplicate_payment' where id=o.id and review_reason is null;
  -- Record the second external payment on its own attempt: final technical state, Flow identity kept, no more polling. The original assignment is untouched.
  update private.payment_attempts set state='paid',flow_order=coalesce(flow_order,observed_flow_order),lease_token=null,lease_until=null,check_count=0 where id=a.id;
  perform private.job_emit_provider(j.id,ev,'payment_review_required',jsonb_build_object('order_id',o.id,'reason','duplicate_payment'));
 end if;
 perform private.sync_job_payment_state(j.id);
 return jsonb_build_object('result',verdict);
end; $$;

-- ---------------------------------------------------------------------------------------------
-- Cancellation vs. payments (PLAN 7.5): when a job becomes cancelled, every paid order and every order with a still-payable attempt goes to
-- financial review IN THE SAME STATEMENT/LOCK as the cancellation (the job row is already locked; orders are locked in the same order as
-- payment_apply_observation: job -> order). A verified payment stays 'paid' (no refund, no release); one deduplicated internal event and one
-- notice per participant record the reason. The inverse order (payment observed after cancellation) is handled by payment_apply_observation (late_payment).
-- BEFORE trigger named to sort ahead of immutable_job so the payment_state projection it sets is the one the contract guard validates.
-- ---------------------------------------------------------------------------------------------
create function private.job_cancellation_payment_review()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare o private.payment_orders; ev uuid;
begin
 if new.status<>'cancelled' or old.status='cancelled' then return new; end if;
 for o in select * from private.payment_orders p where p.job_id=new.id and p.review_reason is null
   and(p.status='paid' or(p.status='awaiting_payment' and exists(select 1 from private.payment_attempts a where a.order_id=p.id and a.state in('prepared','creating','pending','reconciliation_required'))))
   order by p.created_at,p.id for update loop
  update private.payment_orders set review_reason='job_cancelled' where id=o.id;
  ev:=null;
  insert into private.payment_events(order_id,provider_event_key,observed_status,validation)values(o.id,'job_cancelled:'||o.id,0,'job_cancelled')on conflict do nothing returning id into ev;
  if ev is not null then perform private.job_emit_provider(new.id,ev,'payment_review_required',jsonb_build_object('order_id',o.id,'reason','job_cancelled')); end if;
 end loop;
 new.payment_state:=private.job_payment_projection(new.id);
 return new;
end; $$;
create trigger a_job_cancellation_payment_review before update on public.jobs for each row execute function private.job_cancellation_payment_review();

-- ---------------------------------------------------------------------------------------------
-- job_command: confirm_completion also requires every accepted extra to be paid (same job lock as acceptance).
-- ---------------------------------------------------------------------------------------------
do $$ declare src text; begin
 select pg_get_functiondef(p.oid) into src from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='job_command';
 if position('Finalización aún no informada' in src)=0 then raise exception 'job_command inesperado'; end if;
 src:=replace(src,'j.status:=''completed'';j.customer_confirmed_at:=now();',
  'if private.job_open_obligations(j.id) then raise exception ''Hay importes aceptados pendientes de pago'' using errcode=''PT409'';end if;j.status:=''completed'';j.customer_confirmed_at:=now();');
 if position('job_open_obligations' in src)=0 then raise exception 'No se pudo extender confirm_completion'; end if;
 -- PLAN 7.5 is the commercial policy for payments: a cancellation of a job with payments is allowed and goes to financial review (trigger above).
 -- Sprint 04's blanket block on payment_state<>'not_enabled' is removed; a started job still needs a separate commercial policy.
 src:=replace(src,'(j.started_at is not null or j.payment_state<>''not_enabled'')',' j.started_at is not null ');
 if position('payment_state<>''not_enabled''' in src)>0 then raise exception 'No se pudo extender resolve_cancellation'; end if;
 execute src;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Grants: least privilege.
-- ---------------------------------------------------------------------------------------------
revoke all on function private.payment_fee_clp(bigint,integer),private.guard_extra_charge(),private.guard_payment_order(),private.guard_payment_attempt(),
 private.payment_events_append_only(),private.payment_policy_append_only(),private.job_cancellation_payment_review(),private.job_payment_projection(uuid),private.sync_job_payment_state(uuid),private.job_emit_provider(uuid,uuid,text,jsonb),
 private.job_unpaid_extras(uuid),private.job_settlement_eligible(uuid),private.job_open_obligations(uuid),private.lock_job_for_payments(uuid),private.require_superadmin(),private.require_service_role()from public,anon,authenticated,service_role;
revoke all on function private.guard_job_contract(),private.job_execution_allowed(uuid)from public,anon,authenticated,service_role;
revoke all on function public.payment_policy_current(),public.payment_policy_set(integer,integer,text),public.payment_prepare(uuid,uuid,integer,boolean,uuid),
 public.job_extra_propose(uuid,uuid,text,bigint),public.job_extra_respond(uuid,text,integer,text),public.job_payments(uuid),public.payment_request_reconciliation(uuid),
 public.payment_admin_overview(),public.payment_enable_sandbox_job(uuid,integer,text),
 public.payment_attempt_begin_create(uuid),public.payment_attempt_set_checkout(uuid,bigint,bytea,text),public.payment_attempt_mark_ambiguous(uuid,text),
 public.payment_attempt_mark_failed(uuid,text),public.payment_attempt_checkout(uuid,uuid),public.payment_inbox_receive(text,bytea,text),public.payment_inbox_claim(),public.payment_inbox_finish(uuid,uuid,text,integer,text),
 public.payment_attempt_claim_due(),public.payment_attempt_release(uuid,uuid,integer,text),public.payment_attempt_lookup(text,bigint),
 public.payment_apply_observation(uuid,text,bigint,text,integer,bigint,text,bigint,timestamptz)from public,anon,authenticated,service_role;
grant execute on function public.payment_policy_current(),public.payment_policy_set(integer,integer,text),public.payment_prepare(uuid,uuid,integer,boolean,uuid),
 public.job_extra_propose(uuid,uuid,text,bigint),public.job_extra_respond(uuid,text,integer,text),public.job_payments(uuid),public.payment_request_reconciliation(uuid),
 public.payment_admin_overview(),public.payment_enable_sandbox_job(uuid,integer,text)to authenticated;
grant execute on function public.payment_attempt_begin_create(uuid),public.payment_attempt_set_checkout(uuid,bigint,bytea,text),public.payment_attempt_mark_ambiguous(uuid,text),
 public.payment_attempt_mark_failed(uuid,text),public.payment_attempt_checkout(uuid,uuid),public.payment_inbox_receive(text,bytea,text),public.payment_inbox_claim(),public.payment_inbox_finish(uuid,uuid,text,integer,text),
 public.payment_attempt_claim_due(),public.payment_attempt_release(uuid,uuid,integer,text),public.payment_attempt_lookup(text,bigint),
 public.payment_apply_observation(uuid,text,bigint,text,integer,bigint,text,bigint,timestamptz)to service_role;
commit;
