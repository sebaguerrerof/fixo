// Explicitly authorized existing-Fixo test. Every isolation assertion uses an actor JWT.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { PDFDocument } from 'pdf-lib';
const ref='rjzyqdhotcshvbdcrgon';assert.equal(process.env.FIXO_SPRINT03_AUTHORIZED,ref);
const env={};for(const line of(await readFile('.env.local','utf8')).split(/\r?\n/)){const m=line.match(/^([A-Z_][A-Z_0-9]*)\s*=\s*(.*)$/);if(m)env[m[1]]=m[2].replace(/^(['"])(.*)\1$/,'$2');}
assert.equal(new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname,ref+'.supabase.co');
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const fresh=()=>createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,options);
const bootstrap=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,options);
const runId=randomUUID(),dir='.audit-backups/sprint03-native/'+runId;
await mkdir(dir,{recursive:true});
const manifest={runId,project:ref,actors:[],requirements:[],documents:[],requests:[],quotes:[],objects:[],jobs:[],checks:[]};
const persist=()=>writeFile(dir+'/manifest.json',JSON.stringify(manifest,null,2));
const lines=createInterface({input:process.stdin}),iterator=lines[Symbol.asyncIterator]();
const api={};
const rpc=async(actor,name,args={})=>{const r=await api[actor].rpc(name,args);assert.equal(r.error,null,name+': '+(r.error?.message??''));return r.data;};
async function check(name,fn){manifest.currentCheck=name;await persist();await fn();manifest.checks.push(name);await persist();console.log('PASS '+name);}
try{
 for(const label of ['customerA','customerB','technicianA','technicianB','ineligible','administrator']){
 const email='fixo-test-'+runId+'-'+label.toLowerCase()+'@local.invalid',password='Synthetic-'+randomUUID()+'9aA',type=label.startsWith('technician')||label==='ineligible'?'technician':'customer';
 const created=await bootstrap.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{first_name:'Synthetic',last_name:label,phone:'+56912345678',terms_accepted:true,account_type:type,fixo_test_run:runId}});assert.equal(created.error,null);
 const actor={label,id:created.data.user.id,email,password};manifest.actors.push(actor);await persist();api[label]=fresh();assert.equal((await api[label].auth.signInWithPassword({email,password})).error,null);
 }
 const admin=manifest.actors.find(a=>a.label==='administrator');
 const sql=`update public.profiles p set role='superadmin' from auth.users u where p.id=u.id and p.id='${admin.id}'::uuid and p.role='customer' and u.email='${admin.email}' and u.raw_user_meta_data->>'fixo_test_run'='${runId}' returning p.id,p.role;`;
 await writeFile(dir+'/bootstrap.sql',sql);console.log(JSON.stringify({checkpoint:'roles',manifest:dir+'/manifest.json',sql:dir+'/bootstrap.sql'}));
 assert.equal((await iterator.next()).value?.trim(),'roles-ready');
 const profile={city:'Ñuñoa',coverage:['Ñuñoa'],headline:'Servicios sintéticos de gasfitería',bio:'Experiencia sintética para probar el marketplace y su autorización de oportunidades.',categories:['gasfiteria'],primaryCategory:'gasfiteria',specialties:['Prueba sintética'],years:5,price:25000,availability:'Mañanas',portfolio:[]};
 let requirement;
 await check('synthetic internal requirement configured with administrator JWT',async()=>{requirement=await rpc('administrator','admin_version_requirement',{category:'gasfiteria',key:'synthetic-'+runId.slice(0,8),requirement_kind:'internal',is_required:true,document_kind:'other',description:'Synthetic marketplace integration criterion',source_url:null,reason:'Synthetic marketplace verification'});manifest.requirements.push(requirement);});
 for(const label of ['technicianA','technicianB'])await check(label+' real professional approval and queued ClamAV inspection',async()=>{
 let application=await rpc(label,'professional_application');await rpc(label,'save_professional_application',{payload:profile,expected_revision:application.revision,operation_id:randomUUID()});
 const id=randomUUID(),actor=manifest.actors.find(a=>a.label===label),path=actor.id+'/'+id+'.pdf';
 const pdf=await PDFDocument.create();pdf.addPage().drawText('Fixo synthetic marketplace document');const bytes=Buffer.from(await pdf.save());
 assert.equal((await api[label].storage.from('technician-documents').upload(path,bytes,{contentType:'application/pdf',cacheControl:'0'})).error,null);
 manifest.objects.push({bucket:'technician-documents',path});manifest.documents.push(id);await persist();
 await rpc(label,'register_professional_document',{document_id:id,requirement,object_path:path,replaces:null});
 assert.ok((await api[label].storage.from('technician-documents').download(path,{cacheNonce:randomUUID()},{cache:'no-store'})).error);
 await promisify(execFile)(process.execPath,['scripts/inspection-worker.mjs','--once'],{env:{...process.env,FIXO_INSPECTION_PROJECT:ref,FIXO_INSPECTION_LOAD_LOCAL:'true'},timeout:200000,windowsHide:true,maxBuffer:16000});
 const inspected=await api[label].from('technician_documents').select('inspection_status,inspection_engine').eq('id',id).single();assert.equal(inspected.error,null);assert.equal(inspected.data.inspection_status,'clean');assert.match(inspected.data.inspection_engine,/^ClamAV /);
 await rpc('administrator','admin_review_professional_document',{document_id:id,decision:'approved',reason:'Synthetic document reviewed'});
 application=await rpc(label,'professional_application');await rpc(label,'submit_professional_application',{expected_revision:application.revision,consent:true,operation_id:randomUUID()});
 application=await rpc(label,'professional_application');await rpc('administrator','admin_decide_professional_application',{target:actor.id,decision:'approved',expected_revision:application.revision,reason:'Synthetic complete review',operation_id:randomUUID()});
 assert.equal((await rpc(label,'professional_application')).published,true);
 });
 const payload={title:'Solicitud sintética '+runId.slice(0,8),categoryId:'gasfiteria',description:'Reparar una fuga de agua bajo el lavaplatos. Solo datos sintéticos.',locationLabel:'Nunoa',address:'Dirección sintética privada 123',reference:'Solo prueba',preferredSlot:'Mañana',scheduledFor:null};
 const operation_id=randomUUID();let request;
 await check('customer A publishes, persists and retries without duplicate',async()=>{request=await rpc('customerA','marketplace_create_request',{operation_id,payload});manifest.requests.push(request.id);assert.equal((await rpc('customerA','marketplace_create_request',{operation_id,payload})).id,request.id);assert.equal(request.status,'submitted');});
 await check('customer B REST/RPC isolation and no generic privileged DML',async()=>{
 const rows=await api.customerB.from('service_requests').select('id').eq('id',request.id);assert.equal(rows.error,null);assert.deepEqual(rows.data,[]);
 assert.equal(await rpc('customerB','marketplace_request_detail',{request_id:request.id}),null);
 assert.ok((await api.customerA.from('service_requests').update({status:'completed'}).eq('id',request.id)).error);
 assert.ok((await api.customerA.rpc('marketplace_create_request',{operation_id:randomUUID(),payload:{...payload,customer_id:manifest.actors.find(a=>a.label==='customerB').id}})).error);
 });
 await check('eligible JWT discovers redacted opportunity; unapproved JWT blocked',async()=>{
 const opportunities=await rpc('technicianA','marketplace_opportunities');const row=opportunities.find(r=>r.id===request.id);assert.ok(row);assert.equal(row.customer_id,undefined);
 assert.equal((await rpc('technicianA','marketplace_request_detail',{request_id:request.id})).details.address,undefined);
 assert.deepEqual(await rpc('ineligible','marketplace_opportunities'),[]);
 assert.equal((await api.technicianA.from('service_requests').select('id').eq('id',request.id)).data.length,0);
 });
 const quotePayload={laborClp:20000,materialsClp:5000,diagnosticClp:0,description:'Reparación sintética del problema descrito y revisión final.',materialsIncluded:'Sello',materialsNotIncluded:'',diagnosticVisit:false,estimatedDuration:'2 horas',availableDate:new Date(Date.now()+86400000).toISOString(),conditions:'Propuesta sintética sin pago ni ejecución habilitados',expiresAt:new Date(Date.now()+172800000).toISOString()};
 const quotes={};
 await check('ineligible cannot quote or forge owner/status; invalid dates roll back',async()=>{
 assert.ok((await api.ineligible.rpc('marketplace_save_quote',{request_id:request.id,operation_id:randomUUID(),payload:quotePayload})).error);
 assert.ok((await api.technicianA.rpc('marketplace_save_quote',{request_id:request.id,operation_id:randomUUID(),payload:{...quotePayload,status:'accepted'}})).error);
 assert.ok((await api.technicianA.rpc('marketplace_save_quote',{request_id:request.id,operation_id:randomUUID(),payload:{...quotePayload,expiresAt:'2000-01-01'}})).error);
 assert.equal((await api.technicianA.from('quotes').select('id')).data.length,0);
 });
 for(const label of ['technicianA','technicianB'])await check(label+' draft persists, version edit, submit and retry',async()=>{
 const args={request_id:request.id,operation_id:randomUUID(),payload:quotePayload,expected_revision:0};let q=await rpc(label,'marketplace_save_quote',args);assert.equal((await rpc(label,'marketplace_save_quote',args)).id,q.id);
 assert.equal((await api.customerA.from('quotes').select('id').eq('id',q.id)).data.length,0);
 q=await rpc(label,'marketplace_save_quote',{...args,operation_id:randomUUID(),expected_revision:q.revision});
 const change={quote_id:q.id,next_status:'submitted',expected_revision:q.revision};q=await rpc(label,'marketplace_transition_quote',change);assert.equal((await rpc(label,'marketplace_transition_quote',change)).id,q.id);
 assert.equal(q.price_clp,25000);quotes[label]=q;manifest.quotes.push(q.id);
 });
 await check('withdraw -> edit -> resubmit uses a single versioned quote',async()=>{let q=quotes.technicianA;
 q=await rpc('technicianA','marketplace_transition_quote',{quote_id:q.id,next_status:'withdrawn',expected_revision:q.revision});
 q=await rpc('technicianA','marketplace_save_quote',{request_id:request.id,operation_id:randomUUID(),payload:quotePayload,expected_revision:q.revision});
 q=await rpc('technicianA','marketplace_transition_quote',{quote_id:q.id,next_status:'submitted',expected_revision:q.revision});quotes.technicianA=q;});
 await check('customer proposals are scoped and counts are real',async()=>{assert.equal((await api.customerB.from('quotes').select('id')).data.length,0);const list=await rpc('customerA','marketplace_customer_requests');assert.equal(list.items.find(r=>r.id===request.id).quote_count,2);});
 const techA=manifest.actors.find(a=>a.label==='technicianA');
 await check('suspension blocks old JWT opportunities and acceptance, then reversible',async()=>{
 await rpc('administrator','admin_change_account',{target_user:techA.id,new_status:'suspended',new_role:null,change_reason:'Synthetic suspension regression',operation_id:randomUUID()});
 assert.ok((await api.technicianA.rpc('marketplace_opportunities')).error);
 assert.equal((await api.customerA.rpc('marketplace_accept_quote',{request_id:request.id,quote_id:quotes.technicianA.id,expected_revision:quotes.technicianA.revision})).error?.code,'PT409');
 await rpc('administrator','admin_change_account',{target_user:techA.id,new_status:'active',new_role:null,change_reason:'Synthetic suspension reverted',operation_id:randomUUID()});
 });
 let award;
 await check('two simultaneous acceptances yield one award, one PT409 and immutable snapshot',async()=>{
 const results=await Promise.all(Object.values(quotes).map(q=>api.customerA.rpc('marketplace_accept_quote',{request_id:request.id,quote_id:q.id,expected_revision:q.revision})));
 assert.equal(results.filter(r=>!r.error).length,1);assert.equal(results.find(r=>r.error).error.code,'PT409');award=results.find(r=>!r.error).data;manifest.jobs.push(award.job.id);
 assert.equal(award.job.status,'awarded');assert.equal(award.job.payment_state,'not_enabled');assert.equal(award.job.snapshot.priceClp,25000);
 assert.equal((await api.customerA.from('jobs').select('id').eq('service_request_id',request.id)).data.length,1);
 const retry=await rpc('customerA','marketplace_accept_quote',{request_id:request.id,quote_id:award.quote.id,expected_revision:1});assert.equal(retry.job.id,award.job.id);assert.deepEqual(retry.job.snapshot,award.job.snapshot);
 assert.ok((await api.customerA.from('jobs').update({snapshot:{priceClp:1}}).eq('id',award.job.id)).error);
 assert.ok((await api.customerA.from('jobs').update({status:'in_progress'}).eq('id',award.job.id)).error);
 });
 await check('selected active technician gets private address; others cannot',async()=>{
 const winner=Object.keys(quotes).find(k=>quotes[k].id===award.quote.id),loser=Object.keys(quotes).find(k=>quotes[k].id!==award.quote.id);
 assert.equal((await rpc(winner,'marketplace_request_detail',{request_id:request.id})).details.address,payload.address);
 assert.equal(await rpc(loser,'marketplace_request_detail',{request_id:request.id}),null);manifest.winner=winner;
 });
 await check('administrator supervision sees exact actor history and single job',async()=>{
 const detail=await rpc('administrator','marketplace_admin_detail',{request_id:request.id});assert.equal(detail.job.id,award.job.id);
 const events=detail.history.filter(e=>e.action==='quote_accepted');assert.equal(events.length,1);assert.equal(events[0].actor_id,manifest.actors.find(a=>a.label==='customerA').id);
 assert.ok((await api.customerB.rpc('marketplace_admin_detail',{request_id:request.id})).error);
 });
 await check('cancel ownership, state transition and retry',async()=>{
 const r=await rpc('customerA','marketplace_create_request',{operation_id:randomUUID(),payload});manifest.requests.push(r.id);
 assert.ok((await api.customerB.rpc('marketplace_cancel_request',{request_id:r.id,expected_revision:1})).error);
 assert.equal((await rpc('customerA','marketplace_cancel_request',{request_id:r.id,expected_revision:1})).status,'cancelled');
 assert.equal((await rpc('customerA','marketplace_cancel_request',{request_id:r.id,expected_revision:1})).status,'cancelled');
 });
 manifest.stage='browser-ready';manifest.award=award;await persist();
 console.log(JSON.stringify({status:'PASS integración',checks:manifest.checks.length,manifest:dir+'/manifest.json',readyForBrowser:true}));
}catch(error){manifest.stage='failed';await persist();throw error;}finally{lines.close();}
