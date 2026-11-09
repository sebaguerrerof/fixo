-- Sprint 02: private applications and requirements; no legal requirements are invented.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

create table private.category_requirements (
 id uuid primary key default gen_random_uuid(), category_id text not null references public.categories(id),
 requirement_key text not null check(requirement_key ~ '^[a-z0-9-]{2,60}$'), version integer not null,
 kind text not null check(kind in ('legal','internal','optional')), required boolean not null,
 document_type text not null check(document_type in ('identity','certificate','license','other')),
 description text not null check(char_length(description) between 3 and 1000), source_url text,
 active boolean not null default true, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(),
 check(kind <> 'legal' or (source_url is not null and source_url ~ '^https://[^[:space:]]+$')),
 check(kind <> 'optional' or not required), unique(category_id,requirement_key,version)
);
create unique index category_requirements_current_idx on private.category_requirements(category_id,requirement_key) where active;
create table private.technician_applications (
 technician_id uuid primary key references public.technician_profiles(user_id) on delete cascade,
 revision integer not null default 1, state text not null default 'draft' check(state in ('draft','submitted','needs_information','approved','rejected','suspended')),
 primary_category text references public.categories(id), availability text not null default '' check(char_length(availability)<=500),
 portfolio text[] not null default '{}' check(cardinality(portfolio)<=10), consent_at timestamptz,
 requirement_snapshot uuid[] not null default '{}', approved_fingerprint text,
 submitted_at timestamptz, reviewed_at timestamptz, review_reason text, updated_at timestamptz not null default now()
);
create table private.professional_events (
 id uuid primary key default gen_random_uuid(), technician_id uuid references public.technician_profiles(user_id) on delete restrict,
 actor_id uuid references public.profiles(id) on delete restrict, action text not null,
 previous_state text, next_state text, reason text not null check(char_length(reason) between 3 and 1000),
 details jsonb not null default '{}', operation_id uuid unique, created_at timestamptz not null default now()
);
create index professional_events_technician_idx on private.professional_events(technician_id,created_at desc);
create index professional_events_actor_idx on private.professional_events(actor_id);
create index category_requirements_creator_idx on private.category_requirements(created_by);
alter table private.category_requirements enable row level security;
alter table private.technician_applications enable row level security;
alter table private.professional_events enable row level security;
revoke all on private.category_requirements,private.technician_applications,private.professional_events from public,anon,authenticated;

alter table public.technician_documents
 add column requirement_id uuid references private.category_requirements(id),
 add column inspection_status text not null default 'quarantined' check(inspection_status in ('quarantined','clean','unsafe','error')),
 add column inspection_engine text,
 add column inspected_at timestamptz,
 add column sha256 text check(sha256 ~ '^[0-9a-f]{64}$'),
 add column detected_mime text check(detected_mime in ('application/pdf','image/jpeg','image/png')),
 add column byte_size integer check(byte_size between 1 and 10485760),
 add column current_document boolean not null default true,
 add column review_reason text;
create index technician_documents_requirement_idx on public.technician_documents(requirement_id);
create index technician_documents_owner_idx on public.technician_documents(technician_id);
create index technician_documents_reviewer_idx on public.technician_documents(reviewed_by);

create function private.professional_fingerprint(target uuid)
returns text language sql stable security definer set search_path=pg_catalog as $$
 select md5(jsonb_build_object('name',p.full_name,'city',t.city,'coverage',t.coverage_areas,
 'headline',t.headline,'bio',t.bio,'years',t.years_of_experience,'price',t.starting_price_clp,
 'categories',(select jsonb_agg(category_id order by category_id) from public.technician_categories where technician_id=target),
 'specialties',(select jsonb_agg(name order by name) from public.technician_specialties where technician_id=target),
 'primary',a.primary_category,'availability',a.availability,'portfolio',a.portfolio)::text)
 from public.technician_profiles t join public.profiles p on p.id=t.user_id
 join private.technician_applications a on a.technician_id=t.user_id where t.user_id=target;
$$;
create function private.professional_requirements_satisfied(target uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from private.technician_applications a where a.technician_id=target
   and a.consent_at is not null and cardinality(a.requirement_snapshot)>0
   and a.requirement_snapshot=array(select id from private.category_requirements where active and category_id=a.primary_category order by id)
   and not exists(select 1 from private.category_requirements r where r.id=any(a.requirement_snapshot) and r.required
     and not exists(select 1 from public.technician_documents d where d.technician_id=target and d.requirement_id=r.id
       and d.current_document and d.status='approved' and d.inspection_status='clean')));
$$;
create or replace function private.public_technician(target uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from public.profiles p join public.technician_profiles t on t.user_id=p.id
 join private.technician_applications a on a.technician_id=t.user_id
 where p.id=target and p.role='technician' and p.account_status='active' and t.status in ('verified','active')
 and not private.has_unaccepted_invitation(p.id) and a.state='approved'
 and a.approved_fingerprint=private.professional_fingerprint(target) and private.professional_requirements_satisfied(target));
$$;
create function private.initialize_professional_application()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
 begin insert into private.technician_applications(technician_id) values(new.user_id) on conflict do nothing; return new; end;
$$;
create trigger initialize_professional_application after insert on public.technician_profiles
 for each row execute function private.initialize_professional_application();
insert into private.technician_applications(technician_id) select user_id from public.technician_profiles on conflict do nothing;

-- Legacy profile RPCs and identity edits also invalidate an approval/revision.
create function private.invalidate_professional_application()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare target uuid; previous text;
begin
 if tg_table_name='profiles' then target:=new.id;
 elsif tg_table_name='technician_profiles' then target:=new.user_id;
 elsif tg_op='DELETE' then target:=old.technician_id;
 else target:=new.technician_id; end if;
 select state into previous from private.technician_applications where technician_id=target for update;
 update private.technician_applications set state='draft',revision=revision+1,approved_fingerprint=null,updated_at=now() where technician_id=target;
 if found then insert into private.professional_events(technician_id,actor_id,action,previous_state,next_state,reason)
 values(target,auth.uid(),'profile_changed',previous,'draft','Cambio de antecedentes requiere nueva revisión'); end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end;
$$;
create trigger invalidate_professional_identity after update of full_name on public.profiles for each row
 when(old.full_name is distinct from new.full_name) execute function private.invalidate_professional_application();
create trigger invalidate_professional_details after update of city,coverage_areas,headline,bio,years_of_experience,starting_price_clp on public.technician_profiles for each row
 when((old.city,old.coverage_areas,old.headline,old.bio,old.years_of_experience,old.starting_price_clp)
 is distinct from (new.city,new.coverage_areas,new.headline,new.bio,new.years_of_experience,new.starting_price_clp)) execute function private.invalidate_professional_application();
create trigger invalidate_professional_categories after insert or update or delete on public.technician_categories for each row execute function private.invalidate_professional_application();
create trigger invalidate_professional_specialties after insert or update or delete on public.technician_specialties for each row execute function private.invalidate_professional_application();

create function public.professional_requirements(category text)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if not private.is_active_account() then raise exception 'Cuenta no habilitada' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(r) - 'created_by' order by requirement_key) from private.category_requirements r where r.category_id=category and active),'[]');
end;
$$;
create function public.admin_version_requirement(category text,key text,requirement_kind text,is_required boolean,document_kind text,description text,source_url text,reason text)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare actor_role public.app_role; next_version integer; result uuid;
begin
 actor_role:=private.require_administrator();
 if actor_role<>'superadmin' then raise exception 'Operación no autorizada' using errcode='42501'; end if;
 if char_length(trim(reason)) not between 3 and 1000 then raise exception 'Motivo obligatorio' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(71301422);
 select coalesce(max(version),0)+1 into next_version from private.category_requirements where category_id=category and requirement_key=key;
 update private.category_requirements set active=false where category_id=category and requirement_key=key and active;
 insert into private.category_requirements(category_id,requirement_key,version,kind,required,document_type,description,source_url,created_by)
 values(category,key,next_version,requirement_kind,is_required,document_kind,description,source_url,auth.uid()) returning id into result;
 insert into private.professional_events(actor_id,action,reason,details) values(auth.uid(),'requirement_versioned',reason,jsonb_build_object('requirement_id',result,'category',category,'version',next_version));
 -- Existing snapshots cease to satisfy publication immediately; resubmission takes current rules.
 return result;
end;
$$;
create function public.professional_application(target uuid default null)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare selected uuid:=coalesce(target,auth.uid()); result jsonb;
begin
 if not private.is_active_account() or (selected<>auth.uid() and not private.is_admin()) then raise exception 'Operación no autorizada' using errcode='42501'; end if;
 select to_jsonb(a)||jsonb_build_object('profile',to_jsonb(t),'name',p.full_name,
 'categories',(select coalesce(jsonb_agg(category_id),'[]') from public.technician_categories where technician_id=selected),
 'specialties',(select coalesce(jsonb_agg(name),'[]') from public.technician_specialties where technician_id=selected),
 'documents',(select coalesce(jsonb_agg(to_jsonb(d) order by created_at desc),'[]') from public.technician_documents d where technician_id=selected),
 'history',(select coalesce(jsonb_agg(to_jsonb(e) order by created_at desc),'[]') from private.professional_events e where technician_id=selected),
 'published',private.public_technician(selected)) into result
 from private.technician_applications a join public.technician_profiles t on t.user_id=a.technician_id join public.profiles p on p.id=t.user_id where a.technician_id=selected;
 return result;
end;
$$;
create function public.save_professional_application(payload jsonb,expected_revision integer,operation_id uuid)
returns integer language plpgsql security definer set search_path=pg_catalog as $$
declare a private.technician_applications; item text; result integer; before_state text;
begin
 if not private.is_active_account() or not exists(select 1 from public.profiles where id=auth.uid() and role='technician') then raise exception 'Operación no autorizada' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(71301422);
 if exists(select 1 from private.professional_events where professional_events.operation_id=save_professional_application.operation_id and actor_id=auth.uid() and action='draft_saved') then
 return (select revision from private.technician_applications where technician_id=auth.uid()); end if;
 select * into a from private.technician_applications where technician_id=auth.uid() for update;
 if a.revision<>expected_revision then raise exception 'Versión desactualizada' using errcode='40001'; end if;
 if exists(select 1 from public.technician_profiles where user_id=auth.uid() and status in ('suspended','temporarily_suspended','banned')) then raise exception 'Perfil suspendido' using errcode='42501'; end if;
 if payload is null or jsonb_typeof(payload)<>'object'
 or char_length(trim(coalesce(payload->>'city',''))) not between 2 and 80
 or char_length(coalesce(payload->>'headline',''))>180 or char_length(coalesce(payload->>'bio',''))>2000
 or char_length(coalesce(payload->>'availability',''))>500
 or coalesce(payload->>'years','') !~ '^\d{1,2}$' or (payload->>'years')::integer>80
 or coalesce(payload->>'price','') !~ '^\d{1,8}$' or (payload->>'price')::integer>10000000
 or jsonb_typeof(payload->'categories') is distinct from 'array' or jsonb_array_length(payload->'categories') not between 1 and 8
 or jsonb_typeof(payload->'coverage') is distinct from 'array' or jsonb_array_length(payload->'coverage')>20
 or jsonb_typeof(payload->'specialties') is distinct from 'array' or jsonb_array_length(payload->'specialties')>20
 or jsonb_typeof(payload->'portfolio') is distinct from 'array' or jsonb_array_length(payload->'portfolio')>10
 then raise exception 'Datos inválidos' using errcode='22023'; end if;
 if not exists(select 1 from jsonb_array_elements_text(payload->'categories') v where v=payload->>'primaryCategory') then raise exception 'Rubro principal inválido' using errcode='22023'; end if;
 for item in select jsonb_array_elements_text(payload->'portfolio') loop
 if item !~ '^https://[^[:space:]@]+$' or char_length(item)>500 then raise exception 'Enlace inválido' using errcode='22023'; end if; end loop;
 before_state:=a.state;
 update public.technician_profiles set city=trim(payload->>'city'),headline=coalesce(payload->>'headline',''),bio=coalesce(payload->>'bio',''),
 coverage_areas=private.metadata_array(payload,'coverage'),years_of_experience=(payload->>'years')::integer,starting_price_clp=(payload->>'price')::integer,
 status='draft',verified_at=null where user_id=auth.uid();
 delete from public.technician_categories where technician_id=auth.uid();
 for item in select jsonb_array_elements_text(payload->'categories') loop
 insert into public.technician_categories values(auth.uid(),item) on conflict do nothing; end loop;
 delete from public.technician_specialties where technician_id=auth.uid();
 for item in select jsonb_array_elements_text(payload->'specialties') loop
 insert into public.technician_specialties(technician_id,name) values(auth.uid(),trim(item)) on conflict do nothing; end loop;
 update private.technician_applications set revision=revision+1,state='draft',primary_category=payload->>'primaryCategory',availability=coalesce(payload->>'availability',''),
 portfolio=array(select jsonb_array_elements_text(payload->'portfolio')),approved_fingerprint=null,updated_at=now(),review_reason=null where technician_id=auth.uid() returning revision into result;
 insert into private.professional_events(technician_id,actor_id,action,previous_state,next_state,reason,operation_id)
 values(auth.uid(),auth.uid(),'draft_saved',before_state,'draft','Antecedentes profesionales actualizados',operation_id);
 return result;
end;
$$;
create function public.submit_professional_application(expected_revision integer,consent boolean,operation_id uuid)
returns integer language plpgsql security definer set search_path=pg_catalog as $$
declare a private.technician_applications; rules uuid[];
begin
 if not private.is_active_account() then raise exception 'Cuenta no habilitada' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(71301422);
 if exists(select 1 from private.professional_events e where e.operation_id=submit_professional_application.operation_id and actor_id=auth.uid() and action='application_submitted') then
 return (select revision from private.technician_applications where technician_id=auth.uid()); end if;
 select * into a from private.technician_applications where technician_id=auth.uid() for update;
 if a.technician_id is null or a.revision<>expected_revision then raise exception 'Versión desactualizada' using errcode='40001'; end if;
 if a.state not in ('draft','needs_information','rejected') or consent is distinct from true or a.primary_category is null
 or not exists(select 1 from public.technician_profiles where user_id=auth.uid() and char_length(trim(headline))>=5 and char_length(trim(bio))>=20 and cardinality(coverage_areas)>0)
 or char_length(trim(a.availability))<3 then raise exception 'Postulación incompleta' using errcode='22023'; end if;
 rules:=array(select id from private.category_requirements where category_id=a.primary_category and active order by id);
 if cardinality(rules)=0 then raise exception 'El rubro aún no tiene criterios de revisión configurados' using errcode='22023'; end if;
 update private.technician_applications set state='submitted',revision=revision+1,requirement_snapshot=rules,consent_at=now(),submitted_at=now(),approved_fingerprint=null,updated_at=now() where technician_id=auth.uid();
 update public.technician_profiles set status='pending_verification',submitted_at=now() where user_id=auth.uid();
 insert into private.professional_events(technician_id,actor_id,action,previous_state,next_state,reason,operation_id)
 values(auth.uid(),auth.uid(),'application_submitted',a.state,'submitted','Consentimiento y envío a revisión',operation_id);
 return a.revision+1;
end;
$$;
create function public.register_professional_document(document_id uuid,requirement uuid,object_path text,replaces uuid default null)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare r private.category_requirements; a private.technician_applications;
begin
 if not private.is_active_account() then raise exception 'Cuenta no habilitada' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(71301422);
 select * into a from private.technician_applications where technician_id=auth.uid() for update;
 if a.technician_id is null or exists(select 1 from public.technician_profiles where user_id=auth.uid() and status in ('suspended','temporarily_suspended','banned')) then raise exception 'Operación no autorizada' using errcode='42501'; end if;
 if exists(select 1 from public.technician_documents where id=document_id and technician_id=auth.uid() and storage_path=object_path) then return document_id; end if;
 select * into r from private.category_requirements where id=requirement and active and category_id=a.primary_category;
 if r.id is null or object_path !~ ('^'||auth.uid()::text||'/'||document_id::text||'\.(pdf|png|jpg)$')
 or not exists(select 1 from storage.objects where bucket_id='technician-documents' and name=object_path)
 then raise exception 'Documento inválido' using errcode='22023'; end if;
 if replaces is not null and not exists(select 1 from public.technician_documents where id=replaces and technician_id=auth.uid() and requirement_id=requirement and current_document) then raise exception 'Reemplazo inválido' using errcode='42501'; end if;
 update public.technician_documents set current_document=false where technician_id=auth.uid() and requirement_id=requirement and current_document;
 insert into public.technician_documents(id,technician_id,document_type,storage_path,requirement_id) values(document_id,auth.uid(),r.document_type,object_path,requirement);
 update private.technician_applications set state='draft',revision=revision+1,approved_fingerprint=null,updated_at=now() where technician_id=auth.uid();
 update public.technician_profiles set status='draft',verified_at=null where user_id=auth.uid();
 insert into private.professional_events(technician_id,actor_id,action,previous_state,next_state,reason,details)
 values(auth.uid(),auth.uid(),'document_uploaded',a.state,'draft','Documento recibido en cuarentena',jsonb_build_object('document_id',document_id,'replaces',replaces));
 return document_id;
end;
$$;
create function public.record_professional_inspection(document_id uuid,content_sha256 text,content_mime text,content_size integer,scan_result text,engine text)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare d public.technician_documents;
begin
 if (select auth.jwt()->>'role') is distinct from 'service_role' then raise exception 'Solo inspector de servidor' using errcode='42501'; end if;
 if scan_result not in ('clean','unsafe','error') or char_length(trim(engine)) not between 3 and 200 then raise exception 'Inspección inválida' using errcode='22023'; end if;
 select * into d from public.technician_documents where id=document_id for update;
 if d.id is null or not d.current_document then raise exception 'Documento no vigente' using errcode='22023'; end if;
 update public.technician_documents set sha256=content_sha256,detected_mime=content_mime,byte_size=content_size,inspection_status=scan_result,inspection_engine=engine,inspected_at=now(),status='pending',reviewed_at=null,reviewed_by=null where id=document_id;
 insert into private.professional_events(technician_id,actor_id,action,reason,details)
 values(d.technician_id,null,'document_inspected','Inspección automatizada de contenido',jsonb_build_object('document_id',document_id,'result',scan_result,'engine',engine,'sha256',content_sha256));
end;
$$;
create function public.admin_review_professional_document(document_id uuid,decision text,reason text)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare actor_role public.app_role; d public.technician_documents;
begin
 actor_role:=private.require_administrator();
 perform pg_advisory_xact_lock(71301422);
 select * into d from public.technician_documents where id=document_id for update;
 if d.id is null or not d.current_document or decision not in ('approved','rejected') or char_length(trim(reason)) not between 3 and 1000 then raise exception 'Revisión inválida' using errcode='22023'; end if;
 if decision='approved' and d.inspection_status<>'clean' then raise exception 'Documento en cuarentena' using errcode='42501'; end if;
 update public.technician_documents set status=decision,reviewed_by=auth.uid(),reviewed_at=now(),review_reason=reason where id=document_id;
 insert into private.professional_events(technician_id,actor_id,action,reason,details)
 values(d.technician_id,auth.uid(),'document_reviewed',reason,jsonb_build_object('document_id',document_id,'decision',decision));
end;
$$;
create function public.admin_professional_queue(state_filter text default null,category_filter text default null)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 perform private.require_administrator();
 return coalesce((select jsonb_agg(to_jsonb(q)) from (
 select a.technician_id,p.full_name,a.state,a.revision,a.primary_category,a.submitted_at,t.status
 from private.technician_applications a join public.profiles p on p.id=a.technician_id join public.technician_profiles t on t.user_id=a.technician_id
 where (state_filter is null or a.state=state_filter) and (category_filter is null or a.primary_category=category_filter)
 order by a.submitted_at nulls last,a.technician_id limit 100) q),'[]');
end;
$$;
create function public.admin_decide_professional_application(target uuid,decision text,expected_revision integer,reason text,operation_id uuid)
returns integer language plpgsql security definer set search_path=pg_catalog as $$
declare actor_role public.app_role; a private.technician_applications; next_status public.technician_status;
begin
 actor_role:=private.require_administrator();
 if target=auth.uid() then raise exception 'No puedes revisar tu postulación' using errcode='42501'; end if;
 if decision not in ('approved','rejected','needs_information','suspended') or char_length(trim(reason)) not between 3 and 1000 then raise exception 'Decisión inválida' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(71301422);
 if exists(select 1 from private.professional_events e where e.operation_id=admin_decide_professional_application.operation_id and actor_id=auth.uid() and technician_id=target and action='application_decided') then
 return (select revision from private.technician_applications where technician_id=target); end if;
 select * into a from private.technician_applications where technician_id=target for update;
 if a.technician_id is null or a.revision<>expected_revision then raise exception 'Versión desactualizada' using errcode='40001'; end if;
 if not exists(select 1 from public.profiles where id=target and role='technician' and account_status='active') then raise exception 'Cuenta no habilitada' using errcode='42501'; end if;
 if decision in ('approved','rejected','needs_information') and a.state<>'submitted' then raise exception 'Postulación fuera de revisión' using errcode='22023'; end if;
 if decision='approved' and not private.professional_requirements_satisfied(target) then raise exception 'Faltan requisitos o documentos revisados' using errcode='42501'; end if;
 if decision='suspended' and a.state<>'approved' then raise exception 'Solo una postulación aprobada puede suspenderse' using errcode='22023'; end if;
 next_status:=case decision when 'approved' then 'active' when 'needs_information' then 'needs_information' when 'suspended' then 'suspended' else 'rejected' end;
 update private.technician_applications set state=decision,revision=revision+1,review_reason=reason,reviewed_at=now(),
 approved_fingerprint=case when decision='approved' then private.professional_fingerprint(target) end,updated_at=now() where technician_id=target;
 update public.technician_profiles set status=next_status,verified_at=case when decision='approved' then now() else null end where user_id=target;
 insert into private.professional_events(technician_id,actor_id,action,previous_state,next_state,reason,operation_id)
 values(target,auth.uid(),'application_decided',a.state,decision,reason,operation_id);
 return a.revision+1;
end;
$$;

-- The legacy status endpoint cannot bypass the new publication gate.
create function private.guard_professional_publication()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 if new.status in ('verified','active') and not exists(select 1 from private.technician_applications a where a.technician_id=new.user_id
 and a.state='approved' and a.approved_fingerprint=private.professional_fingerprint(new.user_id) and private.professional_requirements_satisfied(new.user_id))
 then raise exception 'Postulación y requisitos pendientes' using errcode='42501'; end if;
 return new;
end;
$$;
create trigger guard_professional_publication before update of status on public.technician_profiles
 for each row execute function private.guard_professional_publication();

-- Quarantine cannot be downloaded or signed even by administrators through Storage.
alter policy "Technicians and administrators view verification documents" on storage.objects to authenticated
 using(bucket_id='technician-documents' and private.is_active_account()
 and exists(select 1 from public.technician_documents d where d.storage_path=name and d.current_document and d.inspection_status='clean'
 and (d.technician_id=(select auth.uid()) or private.is_admin())));
-- Immutable object paths: no UPDATE/DELETE permission; replacements use a fresh UUID.
revoke update,delete on public.technician_documents from authenticated,anon;

revoke all on function private.professional_fingerprint(uuid),private.professional_requirements_satisfied(uuid),
 private.initialize_professional_application(),private.invalidate_professional_application(),private.guard_professional_publication() from public,anon,authenticated;
revoke all on function public.professional_requirements(text),public.admin_version_requirement(text,text,text,boolean,text,text,text,text),
 public.professional_application(uuid),public.save_professional_application(jsonb,integer,uuid),public.submit_professional_application(integer,boolean,uuid),
 public.register_professional_document(uuid,uuid,text,uuid),public.record_professional_inspection(uuid,text,text,integer,text,text),
 public.admin_review_professional_document(uuid,text,text),public.admin_professional_queue(text,text),
 public.admin_decide_professional_application(uuid,text,integer,text,uuid) from public,anon,authenticated;
grant execute on function public.professional_requirements(text),public.admin_version_requirement(text,text,text,boolean,text,text,text,text),
 public.professional_application(uuid),public.save_professional_application(jsonb,integer,uuid),public.submit_professional_application(integer,boolean,uuid),
 public.register_professional_document(uuid,uuid,text,uuid),public.admin_review_professional_document(uuid,text,text),
 public.admin_professional_queue(text,text),public.admin_decide_professional_application(uuid,text,integer,text,uuid) to authenticated;
grant execute on function public.record_professional_inspection(uuid,text,text,integer,text,text) to service_role;
commit;
