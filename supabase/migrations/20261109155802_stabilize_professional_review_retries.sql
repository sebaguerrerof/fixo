-- PT409 represents an application version conflict, not a retryable database serialization failure.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

create or replace function public.save_professional_application(payload jsonb,expected_revision integer,operation_id uuid)
returns integer language plpgsql security definer set search_path=pg_catalog as $$
declare a private.technician_applications; item text; result integer; before_state text;
begin
 if not private.is_active_account() or not exists(select 1 from public.profiles where id=auth.uid() and role='technician') then raise exception 'Operación no autorizada' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(71301422);
 if exists(select 1 from private.professional_events where professional_events.operation_id=save_professional_application.operation_id and actor_id=auth.uid() and action='draft_saved') then
 return (select revision from private.technician_applications where technician_id=auth.uid()); end if;
 select * into a from private.technician_applications where technician_id=auth.uid() for update;
 if a.technician_id is null or a.revision is distinct from expected_revision then raise exception 'Versión desactualizada' using errcode='PT409'; end if;
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

create or replace function public.submit_professional_application(expected_revision integer,consent boolean,operation_id uuid)
returns integer language plpgsql security definer set search_path=pg_catalog as $$
declare a private.technician_applications; rules uuid[];
begin
 if not private.is_active_account() then raise exception 'Cuenta no habilitada' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(71301422);
 if exists(select 1 from private.professional_events e where e.operation_id=submit_professional_application.operation_id and actor_id=auth.uid() and action='application_submitted') then
 return (select revision from private.technician_applications where technician_id=auth.uid()); end if;
 select * into a from private.technician_applications where technician_id=auth.uid() for update;
 if a.technician_id is null or a.revision is distinct from expected_revision then raise exception 'Versión desactualizada' using errcode='PT409'; end if;
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

create or replace function public.admin_decide_professional_application(target uuid,decision text,expected_revision integer,reason text,operation_id uuid)
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
 if a.technician_id is null or a.revision is distinct from expected_revision then raise exception 'Versión desactualizada' using errcode='PT409'; end if;
 if not exists(select 1 from public.profiles where id=target and role='technician' and account_status='active') then raise exception 'Cuenta no habilitada' using errcode='42501'; end if;
 if ((decision in ('approved','rejected') and a.state<>'submitted') or (decision='needs_information' and a.state not in ('submitted','suspended'))) then raise exception 'Postulación fuera de revisión' using errcode='22023'; end if;
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

create or replace function public.record_professional_inspection(document_id uuid,content_sha256 text,content_mime text,content_size integer,scan_result text,engine text)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare d public.technician_documents;
begin
 if (select auth.jwt()->>'role') is distinct from 'service_role' then raise exception 'Solo inspector de servidor' using errcode='42501'; end if;
 if scan_result not in ('clean','unsafe','error') or char_length(trim(engine)) not between 3 and 200 then raise exception 'Inspección inválida' using errcode='22023'; end if;
 select * into d from public.technician_documents where id=document_id for update;
 if d.id is null or not d.current_document then raise exception 'Documento no vigente' using errcode='22023'; end if;
 if d.sha256=content_sha256 and d.detected_mime is not distinct from content_mime and d.byte_size=content_size and d.inspection_status=scan_result and d.inspection_engine=engine and d.inspected_at is not null then return; end if;
 update public.technician_documents set sha256=content_sha256,detected_mime=content_mime,byte_size=content_size,inspection_status=scan_result,inspection_engine=engine,inspected_at=now(),status='pending',reviewed_at=null,reviewed_by=null where id=document_id;
 insert into private.professional_events(technician_id,actor_id,action,reason,details)
 values(d.technician_id,null,'document_inspected','Inspección automatizada de contenido',jsonb_build_object('document_id',document_id,'result',scan_result,'engine',engine,'sha256',content_sha256));
end;
$$;

create or replace function public.admin_review_professional_document(document_id uuid,decision text,reason text)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare actor_role public.app_role; d public.technician_documents;
begin
 actor_role:=private.require_administrator();
 perform pg_advisory_xact_lock(71301422);
 select * into d from public.technician_documents where id=document_id for update;
 if d.id is null or not d.current_document or decision not in ('approved','rejected') or char_length(trim(reason)) not between 3 and 1000 then raise exception 'Revisión inválida' using errcode='22023'; end if;
 if decision='approved' and d.inspection_status<>'clean' then raise exception 'Documento en cuarentena' using errcode='42501'; end if;
 if d.status=decision and d.reviewed_by=auth.uid() and d.review_reason=reason then return; end if;
 update public.technician_documents set status=decision,reviewed_by=auth.uid(),reviewed_at=now(),review_reason=reason where id=document_id;
 insert into private.professional_events(technician_id,actor_id,action,reason,details)
 values(d.technician_id,auth.uid(),'document_reviewed',reason,jsonb_build_object('document_id',document_id,'decision',decision));
end;
$$;

create or replace function public.admin_version_requirement(category text,key text,requirement_kind text,is_required boolean,document_kind text,description text,source_url text,reason text)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare actor_role public.app_role; next_version integer; result uuid;
begin
 actor_role:=private.require_administrator();
 if actor_role<>'superadmin' then raise exception 'Operación no autorizada' using errcode='42501'; end if;
 if char_length(trim(reason)) not between 3 and 1000 then raise exception 'Motivo obligatorio' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(71301422);
 select id into result from private.category_requirements r where r.category_id=category and r.requirement_key=key and r.active and r.kind=requirement_kind and r.required=is_required and r.document_type=document_kind and r.description=admin_version_requirement.description and r.source_url is not distinct from admin_version_requirement.source_url;
 if result is not null then return result; end if;
 select coalesce(max(version),0)+1 into next_version from private.category_requirements where category_id=category and requirement_key=key;
 update private.category_requirements set active=false where category_id=category and requirement_key=key and active;
 insert into private.category_requirements(category_id,requirement_key,version,kind,required,document_type,description,source_url,created_by)
 values(category,key,next_version,requirement_kind,is_required,document_kind,description,source_url,auth.uid()) returning id into result;
 insert into private.professional_events(actor_id,action,reason,details) values(auth.uid(),'requirement_versioned',reason,jsonb_build_object('requirement_id',result,'category',category,'version',next_version));
 -- Existing snapshots cease to satisfy publication immediately; resubmission takes current rules.
 return result;
end;
$$;
commit;
