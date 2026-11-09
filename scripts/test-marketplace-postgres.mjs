// Real PostgreSQL compatibility/RLS/concurrency tests. Provider schemas below are
// fixtures, NOT evidence of Supabase Auth, JWT verification or Storage HTTP.
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import EmbeddedPostgres from '../.audit-backups/tooling/sprint03-postgres/node_modules/embedded-postgres/dist/index.js';

const root=resolve('.audit-backups/sprint03-postgres',randomUUID());
await mkdir(root,{recursive:true});
const logs=[];
const server=new EmbeddedPostgres({databaseDir:resolve(root,'data'),port:54403,user:'postgres',password:randomBytes(32).toString('hex'),
 persistent:true,createPostgresUser:false,authMethod:'scram-sha-256',initdbFlags:['--encoding=UTF8','--locale=C'],
 postgresFlags:['-c','listen_addresses=127.0.0.1','-c','max_connections=12','-c','shared_buffers=32MB'],
 onLog:m=>logs.push(String(m)),onError:m=>logs.push(String(m))});
let admin; const clients=[]; let passed=0;
async function check(name,fn){await fn();passed++;console.log('PASS '+name);}
try{
 await server.initialise();await server.start();admin=server.getPgClient('postgres','127.0.0.1');await admin.connect();
 console.log((await admin.query('select version()')).rows[0].version);
 await admin.query(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
 create schema auth; create schema storage; create schema extensions;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz,invited_at timestamptz);
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade,not_after timestamptz);
 create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
 create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
 create function auth.role() returns text language sql stable as $$ select auth.jwt()->>'role' $$;
 grant usage on schema public,auth,storage to anon,authenticated,service_role;
 grant execute on all functions in schema auth to anon,authenticated,service_role;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,owner uuid,metadata jsonb default '{}');
 alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql immutable as $$ select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
 grant select,insert,update,delete on storage.objects to authenticated;
 alter default privileges in schema public grant all on tables to service_role;
 alter default privileges in schema public grant all on sequences to service_role;`);
 for(const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort()){
   try{await admin.query(await readFile(resolve('supabase/migrations',file),'utf8'));console.log('MIGRATION '+file);}
   catch(e){throw new Error('Migration '+file+': '+e.message,{cause:e});}
 }
 const actors={};
 for(const name of ['customerA','customerB','technicianA','technicianB','ineligible','admin']){
 const id=randomUUID(),session=randomUUID(),tech=name.startsWith('technician')||name==='ineligible';
 await admin.query(`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)`,[id,name+'@local.invalid',{first_name:'Synthetic',last_name:name,phone:'+56911111111',terms_accepted:true,account_type:tech?'technician':'customer',category_ids:['gasfiteria'],coverage_areas:['Ñuñoa']}]);
 await admin.query('insert into auth.sessions(id,user_id) values($1,$2)',[session,id]);
 if(name==='admin')await admin.query("update public.profiles set role='superadmin' where id=$1",[id]);
 const client=server.getPgClient('postgres','127.0.0.1');await client.connect();clients.push(client);
 await client.query('set role authenticated');await client.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,session_id:session,role:'authenticated'})]);
 actors[name]={id,client};
 }
 const call=async(name,sql,args=[]) => (await actors[name].client.query(sql,args)).rows[0]?.value;
 const customer=(sql,args=[])=>call('customerA',sql,args);
 const requirement=(await admin.query(`insert into private.category_requirements(category_id,requirement_key,version,kind,required,document_type,description,created_by)
 values('gasfiteria','synthetic-only',1,'internal',false,'other','Synthetic test criterion',$1) returning id`,[actors.admin.id])).rows[0].id;
 for(const name of ['technicianA','technicianB']){
 await admin.query("update private.technician_applications set state='approved',primary_category='gasfiteria',requirement_snapshot=array[$2::uuid],consent_at=now() where technician_id=$1",[actors[name].id,requirement]);
 await admin.query('update private.technician_applications set approved_fingerprint=private.professional_fingerprint(technician_id) where technician_id=$1',[actors[name].id]);
 await admin.query("update public.technician_profiles set status='active' where user_id=$1",[actors[name].id]);
 }
 const payload={title:'Fuga bajo lavaplatos',categoryId:'gasfiteria',description:'Necesito reparar una fuga de agua bajo el lavaplatos.',locationLabel:'  Nunoa ',address:'Synthetic private address',reference:'Synthetic reference',preferredSlot:'Mañana',scheduledFor:null};
 const op=randomUUID();let request;
 await check('customer publishes atomically',async()=>{request=await customer('select public.marketplace_create_request($1,$2) value',[op,payload]);assert.equal(request.customer_id,actors.customerA.id);assert.equal(request.status,'submitted');});
 await check('creation retry same ID / one audit',async()=>{assert.equal((await customer('select public.marketplace_create_request($1,$2) value',[op,payload])).id,request.id);assert.equal((await admin.query('select count(*)::int n from private.marketplace_events where request_id=$1',[request.id])).rows[0].n,1);});
 await check('operation ID rejects different payload',()=>assert.rejects(()=>customer('select public.marketplace_create_request($1,$2) value',[op,{...payload,title:'Different title'}]),{code:'PT409'}));
 await check('customer B REST-equivalent SELECT and RPC isolation',async()=>{assert.equal((await actors.customerB.client.query('select * from public.service_requests where id=$1',[request.id])).rowCount,0);assert.equal(await call('customerB','select public.marketplace_request_detail($1) value',[request.id]),null);});
 await check('no generic INSERT or UPDATE / overposting',async()=>{await assert.rejects(()=>actors.customerA.client.query("update public.service_requests set status='completed' where id=$1",[request.id]),{code:'42501'});await assert.rejects(()=>actors.customerA.client.query('insert into public.service_requests default values'),{code:'42501'});await assert.rejects(()=>customer('select public.marketplace_create_request($1,$2) value',[randomUUID(),{...payload,customer_id:actors.customerB.id}]),{code:'22023'});});
 await check('eligibility and privacy projection',async()=>{const list=await call('technicianA','select public.marketplace_opportunities() value');assert.equal(list.length,1);assert.equal(list[0].customer_id,undefined);const detail=await call('technicianA','select public.marketplace_request_detail($1) value',[request.id]);assert.equal(detail.details.address,undefined);assert.equal(detail.customer_id,undefined);assert.equal((await actors.technicianA.client.query('select * from public.service_requests where id=$1',[request.id])).rowCount,0);assert.deepEqual(await call('ineligible','select public.marketplace_opportunities() value'),[]);});
 const quotePayload={laborClp:20000,materialsClp:5000,diagnosticClp:0,description:'Reparación y revisión completa de la fuga indicada.',materialsIncluded:'Sello',materialsNotIncluded:'',diagnosticVisit:false,estimatedDuration:'2 horas',availableDate:new Date(Date.now()+86400000).toISOString(),conditions:'Solo trabajo descrito',expiresAt:new Date(Date.now()+172800000).toISOString()};
 const quotes={};
 await check('ineligible quote blocked',()=>assert.rejects(()=>call('ineligible','select public.marketplace_save_quote($1,$2,$3) value',[request.id,randomUUID(),quotePayload]),{code:'42501'}));
 for(const name of ['technicianA','technicianB'])await check(name+' draft then submit',async()=>{
 let q=await call(name,'select public.marketplace_save_quote($1,$2,$3) value',[request.id,randomUUID(),quotePayload]);assert.equal(q.price_clp,25000);
 q=await call(name,"select public.marketplace_transition_quote($1,'submitted',$2) value",[q.id,q.revision]);quotes[name]=q;assert.equal(q.status,'submitted');});
 await check('quote customer isolation',async()=>{assert.equal((await actors.customerB.client.query('select * from public.quotes')).rowCount,0);assert.equal((await actors.customerA.client.query('select * from public.quotes')).rowCount,2);});
 await check('expired submitted quote and stale reviewed revision cannot be awarded',async()=>{
 const q=quotes.technicianA;
 await admin.query("update public.quotes set expires_at=now()-interval '1 second' where id=$1",[q.id]);
 await assert.rejects(()=>customer('select public.marketplace_accept_quote($1,$2,$3) value',[request.id,q.id,q.revision]),{code:'PT409'});
 await admin.query('update public.quotes set expires_at=$2 where id=$1',[q.id,quotePayload.expiresAt]);
 await assert.rejects(()=>customer('select public.marketplace_accept_quote($1,$2,$3) value',[request.id,q.id,q.revision-1]),{code:'PT409'});
 assert.equal((await admin.query('select count(*)::int n from public.jobs where service_request_id=$1',[request.id])).rows[0].n,0);
 });
 await check('old session blocked by suspension; approval invalidation',async()=>{
 await admin.query("update public.profiles set account_status='suspended' where id=$1",[actors.technicianA.id]);
 await assert.rejects(()=>call('technicianA','select public.marketplace_opportunities() value'),{code:'42501'});
 await assert.rejects(()=>customer('select public.marketplace_accept_quote($1,$2,$3) value',[request.id,quotes.technicianA.id,quotes.technicianA.revision]),{code:'PT409'});
 await admin.query("update public.profiles set account_status='active' where id=$1",[actors.technicianA.id]);
 await admin.query("update private.technician_applications set state='draft' where technician_id=$1",[actors.technicianA.id]);
 assert.deepEqual(await call('technicianA','select public.marketplace_opportunities() value'),[]);
 await admin.query("update private.technician_applications set state='approved' where technician_id=$1",[actors.technicianA.id]);});
 let award;
 await check('concurrent accept -> exactly one job, snapshot, audit; loser PT409',async()=>{
 const client=server.getPgClient('postgres','127.0.0.1');await client.connect();clients.push(client);await client.query('set role authenticated');
 await client.query("select set_config('request.jwt.claims',$1,false)",[(await actors.customerA.client.query("select current_setting('request.jwt.claims') claims")).rows[0].claims]);
 const results=await Promise.allSettled([actors.customerA.client.query('select public.marketplace_accept_quote($1,$2,$3) value',[request.id,quotes.technicianA.id,quotes.technicianA.revision]),client.query('select public.marketplace_accept_quote($1,$2,$3) value',[request.id,quotes.technicianB.id,quotes.technicianB.revision])]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.code,'PT409');
 award=results.find(r=>r.status==='fulfilled').value.rows[0].value;
 assert.equal(award.job.status,'awarded');assert.equal(award.job.payment_state,'not_enabled');
 assert.equal((await admin.query('select count(*)::int n from public.jobs where service_request_id=$1',[request.id])).rows[0].n,1);
 assert.equal((await admin.query("select count(*)::int n from private.marketplace_events where request_id=$1 and action='quote_accepted' and actor_id=$2",[request.id,actors.customerA.id])).rows[0].n,1);
 });
 await check('accept retry preserves job and frozen terms',async()=>{const retry=await customer('select public.marketplace_accept_quote($1,$2,$3) value',[request.id,award.quote.id,1]);assert.equal(retry.job.id,award.job.id);assert.deepEqual(retry.job.snapshot,award.job.snapshot);await assert.rejects(()=>admin.query("update public.jobs set snapshot='{}' where id=$1",[award.job.id]),{code:'PT409'});await assert.rejects(()=>admin.query("update public.quotes set labor_clp=1 where id=$1",[award.quote.id]),{code:'PT409'});});
 await check('address released only to selected active approved technician',async()=>{const winner=Object.keys(quotes).find(n=>quotes[n].id===award.quote.id);const loser=Object.keys(quotes).find(n=>quotes[n].id!==award.quote.id);assert.equal((await call(winner,'select public.marketplace_request_detail($1) value',[request.id])).details.address,payload.address);assert.equal(await call(loser,'select public.marketplace_request_detail($1) value',[request.id]),null);});
 await check('cancellation ownership, retry, history',async()=>{const r=await customer('select public.marketplace_create_request($1,$2) value',[randomUUID(),payload]);await assert.rejects(()=>call('customerB','select public.marketplace_cancel_request($1,1) value',[r.id]),{code:'42501'});assert.equal((await customer('select public.marketplace_cancel_request($1,1) value',[r.id])).status,'cancelled');assert.equal((await customer('select public.marketplace_cancel_request($1,1) value',[r.id])).status,'cancelled');});
 await check('worker RPC denied to authenticated',()=>assert.rejects(()=>customer('select public.claim_professional_inspection() value'),{code:'42501'}));
 await check('secondary category declaration never substitutes category approval',async()=>{
 await admin.query("insert into public.technician_categories values($1,'jardineria')",[actors.technicianA.id]);
 await admin.query("update private.technician_applications set state='approved',approved_fingerprint=private.professional_fingerprint(technician_id) where technician_id=$1",[actors.technicianA.id]);
 const r=await customer('select public.marketplace_create_request($1,$2) value',[randomUUID(),{...payload,categoryId:'jardineria'}]);
 assert.equal(await call('technicianA','select public.marketplace_request_detail($1) value',[r.id]),null);
 await assert.rejects(()=>call('technicianA','select public.marketplace_save_quote($1,$2,$3) value',[r.id,randomUUID(),quotePayload]),{code:'42501'});
 });
 await check('private photo ownership and administrator detail',async()=>{
 const r=await customer('select public.marketplace_create_request($1,$2) value',[randomUUID(),payload]);const id=randomUUID();const path=actors.customerA.id+'/'+r.id+'/'+id+'.jpg';
 await admin.query("insert into storage.objects(bucket_id,name) values('service-request-photos',$1)",[path]);
 await customer('select public.marketplace_register_photo($1,$2,$3,100)',[r.id,id,'b'.repeat(64)]);
 assert.equal((await customer('select public.marketplace_photos($1) value',[r.id])).length,1);
 assert.deepEqual(await call('customerB','select public.marketplace_photos($1) value',[r.id]),[]);
 assert.deepEqual(await call('technicianA','select public.marketplace_photos($1) value',[r.id]),[]);
 assert.equal((await actors.customerB.client.query("select * from storage.objects where bucket_id='service-request-photos'")).rowCount,0);
 assert.equal((await call('admin','select public.marketplace_admin_detail($1) value',[r.id])).eligible.length,2);
 await assert.rejects(()=>call('customerB','select public.marketplace_admin_detail($1) value',[r.id]),{code:'42501'});
 });
 await check('queue claim concurrency, lease fencing, retry, quarantine, completion idempotence',async()=>{
 const id=randomUUID();await admin.query("insert into public.technician_documents(id,technician_id,document_type,storage_path) values($1,$2,'other',$3)",[id,actors.technicianA.id,actors.technicianA.id+'/'+id+'.pdf']);
 const worker=server.getPgClient('postgres','127.0.0.1');await worker.connect();clients.push(worker);
 await worker.query('set role service_role');await worker.query("select set_config('request.jwt.claims','{\"role\":\"service_role\"}',false)");
 const lease=(await worker.query('select public.claim_professional_inspection() value')).rows[0].value;assert.equal(lease.document_id,id);
 assert.equal((await worker.query('select public.claim_professional_inspection() value')).rows[0].value,null);
 await assert.rejects(()=>worker.query('select public.finish_professional_inspection($1,$2,$3)',[id,randomUUID(),{result:'clean'}]),{code:'PT409'});
 await worker.query('select public.finish_professional_inspection($1,$2,$3)',[id,lease.lease_token,{result:'error'}]);
 assert.equal((await admin.query('select inspection_status from public.technician_documents where id=$1',[id])).rows[0].inspection_status,'quarantined');
 await admin.query("update private.inspection_jobs set available_at=now()-interval '1 second' where document_id=$1",[id]);
 const retry=(await worker.query('select public.claim_professional_inspection() value')).rows[0].value;assert.equal(retry.attempt,2);assert.notEqual(retry.lease_token,lease.lease_token);
 const result={result:'clean',sha256:'a'.repeat(64),mime:'application/pdf',size:100,engine:'Synthetic contract only'};
 await worker.query('select public.finish_professional_inspection($1,$2,$3)',[id,retry.lease_token,result]);
 await worker.query('select public.finish_professional_inspection($1,$2,$3)',[id,retry.lease_token,result]);
 assert.equal((await admin.query('select inspection_status from public.technician_documents where id=$1',[id])).rows[0].inspection_status,'clean');
 assert.equal((await admin.query('select count(*)::int n from private.professional_events where details->>\'document_id\'=$1',[id])).rows[0].n,1);
 });
 console.log(JSON.stringify({status:'PASS local',checks:passed,provider:'PostgreSQL with Auth/Storage contract fixtures',remote:false}));
 await writeFile(resolve(root,'result.json'),JSON.stringify({status:'PASS local',checks:passed,remote:false},null,2));
}finally{
 for(const client of clients)await client.end().catch(()=>{});
 if(admin)await admin.end().catch(()=>{});
 await server.stop();await writeFile(resolve(root,'postgres.log'),logs.join('\n'));
}
