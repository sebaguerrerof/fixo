// Two-phase cleanup of ONE explicit manifest, never broad email/prefix deletion.
import assert from 'node:assert/strict';import{createHash}from'node:crypto';import{readFile,writeFile,unlink}from'node:fs/promises';import{resolve,sep}from'node:path';import{createClient}from'@supabase/supabase-js';
const ref='rjzyqdhotcshvbdcrgon',run=process.env.FIXO_SPRINT03_RUN;assert.equal(process.env.FIXO_SPRINT03_AUTHORIZED,ref);assert.match(run??'',/^[0-9a-f-]{36}$/);
const dir='.audit-backups/sprint03-native/'+run,file=dir+'/manifest.json',m=JSON.parse(await readFile(file,'utf8'));assert.equal(m.project,ref);assert.equal(m.runId,run);
const env={};for(const line of(await readFile('.env.local','utf8')).split(/\r?\n/)){const x=line.match(/^([A-Z_][A-Z_0-9]*)\s*=\s*(.*)$/);if(x)env[x[1]]=x[2].replace(/^(['"])(.*)\1$/,'$2');}
assert.equal(new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname,ref+'.supabase.co');
const options={auth:{persistSession:false,autoRefreshToken:false}},admin=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,options),ids=[];
for(const a of m.actors){assert.match(a.id,/^[0-9a-f-]{36}$/);assert.ok(a.email.startsWith('fixo-test-'+run+'-')&&a.email.endsWith('@local.invalid'));const r=await admin.auth.admin.getUserById(a.id);if(r.error?.code==='user_not_found')continue;assert.equal(r.error,null);assert.equal(r.data.user.email,a.email);assert.equal(r.data.user.user_metadata.fixo_test_run,run);ids.push(a.id);}
const uuid=id=>{assert.match(id,/^[0-9a-f-]{36}$/);return "'"+id+"'::uuid";};
if(process.argv[2]==='prepare'){
 const c=m.actors.find(a=>a.label==='customerA'),client=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,options);assert.equal((await client.auth.signInWithPassword({email:c.email,password:c.password})).error,null);
 for(let page=1;page<=100;page++){const r=await client.rpc('marketplace_customer_requests',{page_number:page});assert.equal(r.error,null);for(const request of r.data.items){assert.equal(request.customer_id,c.id);if(!m.requests.includes(request.id))m.requests.push(request.id);const photos=await client.rpc('marketplace_photos',{request_id:request.id});assert.equal(photos.error,null);for(const photo of photos.data){assert.match(photo.id,/^[0-9a-f-]{36}$/);assert.equal(photo.storage_path,c.id+'/'+request.id+'/'+photo.id+'.jpg');if(!m.objects.some(o=>o.bucket==='service-request-photos'&&o.path===photo.storage_path))m.objects.push({bucket:'service-request-photos',path:photo.storage_path});}}if(page*20>=r.data.total)break;}
 await writeFile(file,JSON.stringify(m,null,2));
 // Exact manifest paths only. Provider removal deletes actual blobs, not merely SQL metadata.
 for(const object of m.objects){assert.ok(['technician-documents','service-request-photos'].includes(object.bucket));assert.ok(m.actors.some(a=>object.path.startsWith(a.id+'/')));if(object.bucket==='technician-documents')assert.ok(m.documents.some(id=>m.actors.some(a=>object.path===a.id+'/'+id+'.pdf')));else assert.ok(m.requests.some(id=>m.actors.some(a=>new RegExp('^'+a.id+'/'+id+'/[0-9a-f-]{36}\\.jpg$').test(object.path))));assert.equal((await admin.storage.from(object.bucket).remove([object.path])).error,null);}
 assert.ok(ids.length);const users=ids.map(uuid).join(','),requests=m.requests.map(uuid).join(',')||'null::uuid',requirements=m.requirements.map(uuid).join(',')||'null::uuid',invitations=(m.invitations??[]).map(uuid).join(',')||'null::uuid';
 const rateKeys=m.actors.flatMap(a=>['login','signup','recover'].map(action=>"'"+action+':'+createHash('sha256').update(a.email.trim().toLowerCase()).digest('hex')+"'"));
 const sql=`begin;
create temporary table sprint03_cleanup_ids(id uuid primary key);
insert into sprint03_cleanup_ids select id from auth.users where id=any(array[${users}]) and raw_user_meta_data->>'fixo_test_run'='${run}';
create temporary table sprint03_cleanup_requests(id uuid primary key);
insert into sprint03_cleanup_requests select id from public.service_requests where id=any(array[${requests}]) and customer_id in(select id from sprint03_cleanup_ids);
do $$ begin
 if (select count(*) from sprint03_cleanup_ids)<>${ids.length} then raise exception 'Fixture identity changed'; end if;
 if exists(select 1 from public.service_requests where customer_id in(select id from sprint03_cleanup_ids) and id not in(select id from sprint03_cleanup_requests)) then raise exception 'Request not in explicit manifest'; end if;
 if exists(select 1 from public.jobs where service_request_id in(select id from sprint03_cleanup_requests) and (customer_id not in(select id from sprint03_cleanup_ids) or technician_id not in(select id from sprint03_cleanup_ids))) then raise exception 'Non-fixture job participant'; end if;
 if exists(select 1 from private.marketplace_events where request_id in(select id from sprint03_cleanup_requests) and actor_id not in(select id from sprint03_cleanup_ids)) then raise exception 'Non-fixture marketplace actor'; end if;
 if exists(select 1 from private.account_events where (actor_id in(select id from sprint03_cleanup_ids) or target_id in(select id from sprint03_cleanup_ids)) and ((actor_id is not null and actor_id not in(select id from sprint03_cleanup_ids)) or(target_id is not null and target_id not in(select id from sprint03_cleanup_ids)))) then raise exception 'Non-fixture account reference'; end if;
 if exists(select 1 from private.professional_events where (actor_id in(select id from sprint03_cleanup_ids) or technician_id in(select id from sprint03_cleanup_ids)) and ((actor_id is not null and actor_id not in(select id from sprint03_cleanup_ids)) or(technician_id is not null and technician_id not in(select id from sprint03_cleanup_ids)))) then raise exception 'Non-fixture professional reference'; end if;
 if exists(select 1 from private.technician_applications where requirement_snapshot&&array[${requirements}] and technician_id not in(select id from sprint03_cleanup_ids)) then raise exception 'Non-fixture application uses criterion'; end if;
end $$;
delete from private.marketplace_events where request_id in(select id from sprint03_cleanup_requests);
delete from public.jobs where service_request_id in(select id from sprint03_cleanup_requests);
delete from public.quotes where service_request_id in(select id from sprint03_cleanup_requests);
delete from public.service_requests where id in(select id from sprint03_cleanup_requests);
delete from private.marketplace_operations where actor_id in(select id from sprint03_cleanup_ids);
delete from private.auth_rate_limits where key=any(array[${rateKeys.join(',')}]);
delete from private.professional_events where actor_id in(select id from sprint03_cleanup_ids) or technician_id in(select id from sprint03_cleanup_ids);
delete from public.technician_documents where id=any(array[${m.documents.map(uuid).join(',')||'null::uuid'}]) and technician_id in(select id from sprint03_cleanup_ids);
delete from private.technician_applications where technician_id in(select id from sprint03_cleanup_ids);
delete from private.category_requirements where id=any(array[${requirements}]) and created_by in(select id from sprint03_cleanup_ids);
delete from private.account_events where actor_id in(select id from sprint03_cleanup_ids) or target_id in(select id from sprint03_cleanup_ids);
delete from public.admin_audit_entries where actor_id in(select id from sprint03_cleanup_ids) and technician_id in(select id from sprint03_cleanup_ids);
delete from private.user_invitations where id=any(array[${invitations}]) and actor_id in(select id from sprint03_cleanup_ids) and (user_id is null or user_id in(select id from sprint03_cleanup_ids));
select jsonb_build_object('verified_fixture_users',(select count(*) from sprint03_cleanup_ids),'fixture_requests',(select count(*) from sprint03_cleanup_requests),'original_identity_digest',(select md5(string_agg(id::text||':'||role::text,',' order by id)) from public.profiles where id not in(select id from sprint03_cleanup_ids))) cleanup;
commit;`;
 await writeFile(dir+'/cleanup.sql',sql);console.log(JSON.stringify({prepared:ids.length,requests:m.requests.length,objects:m.objects.length,sql:dir+'/cleanup.sql'}));
}else if(process.argv[2]==='users'){
 assert.equal(process.env.FIXO_CLEANUP_SQL_CONFIRMED,run);for(const id of ids)assert.equal((await admin.auth.admin.deleteUser(id)).error,null);
 // Remove only the known token files inside this exact run; preserve non-secret evidence.
 const root=resolve(dir);for(const capture of m.emailCaptures??[m.emailCapture]){if(!capture)continue;const folder=resolve(capture.directory);assert.ok(folder.startsWith(root+sep+'mailpit-'));for(const name of['links.json','capture.sqlite','capture.sqlite-wal','capture.sqlite-shm']){const path=resolve(folder,name);assert.ok(path.startsWith(folder+sep));await unlink(path).catch(e=>{if(e.code!=='ENOENT')throw e;});}}
 for(const a of m.actors)a.password=null;m.cleanup={status:'PASS',deletedSyntheticUsers:ids.length,temporaryTokensRemoved:true,completedAt:new Date().toISOString()};await writeFile(file,JSON.stringify(m,null,2));console.log(JSON.stringify(m.cleanup));
}else throw new Error('Expected prepare or users');
