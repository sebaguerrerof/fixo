import assert from 'node:assert/strict';
import {randomUUID}from'node:crypto';

export async function runJobOperationTests({admin,actors,server,clients,check,call,customer,award,payload,quotePayload}){
 const tech=Object.keys(actors).find(k=>actors[k].id===award.job.technician_id),otherTech=tech==='technicianA'?'technicianB':'technicianA';
 const rpc=async(label,id,action,value={},revision=null,operation=randomUUID())=>{
  if(revision===null){const d=await detail(label,id);revision=d?.job.revision??1;}
  return call(label,'select public.job_command($1,$2,$3,$4,$5) value',[id,operation,revision,action,value]);
 };
 const detail=(label,id)=>call(label,'select public.job_detail($1) value',[id]);
 const futureWindow=()=>{const start=new Date(Date.now()+172800000);start.setUTCHours(15,0,0,0);const end=new Date(start.getTime()+2*3600000);const parts=date=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));const s=parts(start),e=parts(end);return{startsAt:start.toISOString(),endsAt:end.toISOString(),localDate:s.year+'-'+s.month+'-'+s.day,startTime:s.hour+':'+s.minute,endTime:e.hour+':'+e.minute,reason:'Synthetic coordination proposal'};};
 async function newJob(){const r=await customer('select public.marketplace_create_request($1,$2) value',[randomUUID(),payload]);let q=await call(tech,'select public.marketplace_save_quote($1,$2,$3) value',[r.id,randomUUID(),quotePayload]);q=await call(tech,"select public.marketplace_transition_quote($1,'submitted',$2) value",[q.id,q.revision]);return(await customer('select public.marketplace_accept_quote($1,$2,$3) value',[r.id,q.id,q.revision])).job.id;}
 async function coordinate(id){await rpc(tech,id,'propose_schedule',futureWindow());const d=await detail('customerA',id);await rpc('customerA',id,'accept_schedule',{proposalId:d.schedules.find(p=>p.state==='proposed').id});}
 async function pilot(id){await admin.query("update private.job_execution_policies set mode='authorized_pilot',approved_by=$2,reason='Synthetic isolated test only, no commercial service',authorized_at=now(),expires_at=now()+interval '2 hours'where job_id=$1",[id,actors.admin.id]);}
 const job=award.job.id;
 await check('S04 participant history scope, default disabled, no generic job UPDATE',async()=>{
 const d=await detail('customerA',job);assert.equal(d.execution_mode,'disabled');assert.equal(d.execution_enabled,false);assert.equal((await detail(tech,job)).job.id,job);assert.equal(await detail('customerB',job),null);assert.equal(await detail(otherTech,job),null);
 await assert.rejects(()=>actors.customerA.client.query("update public.jobs set status='completed',revision=revision+1 where id=$1",[job]),{code:'42501'});
 assert.equal((await admin.query('select count(*)::int n from private.notification_outbox o join private.job_events e on e.id=o.event_id where e.job_id=$1',[job])).rows[0].n,4);
 });
 let schedule;
 await check('S04 UTC/Santiago schedule, idempotency and counterpart confirmation',async()=>{
 const op=randomUUID(),window=futureWindow(),d=await detail(tech,job);const first=await rpc(tech,job,'propose_schedule',window,d.job.revision,op);assert.deepEqual(await rpc(tech,job,'propose_schedule',window,d.job.revision,op),first);
 await assert.rejects(()=>rpc(tech,job,'propose_schedule',{...window,reason:'Different payload'},d.job.revision,op),{code:'PT409'});
 schedule=(await detail(tech,job)).schedules.find(s=>s.state==='proposed');
 await assert.rejects(()=>rpc(tech,job,'accept_schedule',{proposalId:schedule.id}),{code:'42501'});
 await rpc('customerA',job,'accept_schedule',{proposalId:schedule.id});assert.equal((await detail('customerA',job)).job.status,'scheduled');
 });
 await check('S04 no browser overposting or stale version; disabled execution fails closed',async()=>{
 await assert.rejects(()=>rpc(tech,job,'start',{}),{code:'42501'});await assert.rejects(()=>rpc(tech,job,'prepare',{}),{code:'42501'});
 await assert.rejects(()=>rpc(tech,job,'propose_schedule',{...futureWindow(),status:'completed'}),{code:'22023'});
 await assert.rejects(()=>rpc(tech,job,'propose_schedule',futureWindow(),1),{code:'PT409'});
 await assert.rejects(()=>rpc('admin',job,'confirm_completion',{}),{code:'42501'});
 });
 await check('S04 reschedule supersedes confirmation; reject and alternative are versioned',async()=>{
 await rpc('customerA',job,'propose_schedule',futureWindow());let d=await detail(tech,job);assert.equal(d.schedules.filter(s=>s.state==='proposed').length,1);assert.equal(d.job.confirmed_schedule_id,null);
 await rpc(tech,job,'reject_schedule',{proposalId:d.schedules.find(s=>s.state==='proposed').id,reason:'Synthetic alternative requested'});
 assert.equal((await detail(tech,job)).job.status,'coordination_pending');await coordinate(job);
 });
 await check('S04 pending cancellation blocks advancement and admin approval cancels agenda',async()=>{
 const result=await rpc('customerA',job,'request_cancellation',{reason:'Synthetic cancellation before any execution'});
 await assert.rejects(()=>rpc(tech,job,'propose_schedule',futureWindow()),{code:'PT409'});
 await assert.rejects(()=>rpc('customerA',job,'resolve_cancellation',{cancellationId:result.resource_id,decision:'approved',reason:'Forged self resolution attempt'}),{code:'42501'});
 await rpc('admin',job,'resolve_cancellation',{cancellationId:result.resource_id,decision:'approved',reason:'Synthetic operational cancellation approved'});
 const d=await detail('customerA',job);assert.equal(d.job.status,'cancelled');assert.equal(d.schedules.filter(s=>s.state==='accepted'||s.state==='proposed').length,0);
 await assert.rejects(()=>rpc(tech,job,'propose_schedule',futureWindow()),{code:'PT409'});
 });
 let incidentId;
 await check('S04 claim, information request, participant response and operational resolution',async()=>{
 incidentId=(await rpc('customerA',job,'open_incident',{kind:'other',description:'Synthetic issue for support after cancellation of a test job.'})).resource_id;
 await assert.rejects(()=>rpc(otherTech,job,'reply_incident',{incidentId,message:'Forged access to another job incident'}),{code:'42501'});
 await rpc('admin',job,'request_information',{incidentId,party:'technician',message:'Please provide synthetic additional information'});
 await rpc(tech,job,'reply_incident',{incidentId,message:'Synthetic technician response to the case'});
 await rpc('admin',job,'add_observation',{incidentId,message:'Synthetic operational observation without financial promises'});
 await rpc('admin',job,'resolve_incident',{incidentId,message:'Synthetic support resolved; no compensation or refund'});
 assert.equal((await detail('customerA',job)).incidents[0].state,'resolved');assert.equal((await detail('customerA',job)).job.payment_state,'not_enabled');
 });
 let executable;
 await check('S04 isolated job-scoped pilot enables progression; only customer closes',async()=>{
 executable=await newJob();await coordinate(executable);await pilot(executable);
 await rpc(tech,executable,'prepare');await rpc(tech,executable,'start');await rpc(tech,executable,'progress',{message:'Synthetic work progress recorded for isolated test'});await rpc(tech,executable,'report_completion',{message:'Synthetic completion reported, awaiting customer confirmation'});
 assert.equal((await detail('customerA',executable)).job.status,'completion_reported');
 await assert.rejects(()=>rpc(tech,executable,'confirm_completion'),{code:'42501'});await rpc('customerA',executable,'confirm_completion');
 const d=await detail('customerA',executable);assert.equal(d.job.status,'completed');assert.equal(d.job.payment_state,'not_enabled');assert.equal(d.execution_mode,'authorized_pilot');
 await assert.rejects(()=>admin.query("update public.jobs set snapshot='{}',revision=revision+1 where id=$1",[executable]),{code:'PT409'});
 });
 await check('S04 expired/future pilot and payment-required never imply trusted payment',async()=>{
 const id=await newJob();await coordinate(id);await admin.query("update private.job_execution_policies set mode='payment_required'where job_id=$1",[id]);await assert.rejects(()=>rpc(tech,id,'prepare'),{code:'42501'});
 await pilot(id);await admin.query("update private.job_execution_policies set authorized_at=now()-interval '2 hours',expires_at=now()-interval '1 hour'where job_id=$1",[id]);await assert.rejects(()=>rpc(tech,id,'prepare'),{code:'42501'});
 await admin.query("update private.job_execution_policies set authorized_at=now()+interval '1 hour',expires_at=now()+interval '2 hours'where job_id=$1",[id]);await assert.rejects(()=>rpc(tech,id,'prepare'),{code:'42501'});
 });
 await check('S04 concurrent cancel versus start serializes to one outcome',async()=>{
 const id=await newJob();await coordinate(id);await pilot(id);await rpc(tech,id,'prepare');const rev=(await detail('customerA',id)).job.revision;
 const results=await Promise.allSettled([rpc('customerA',id,'request_cancellation',{reason:'Synthetic concurrent cancellation request'},rev),rpc(tech,id,'start',{},rev)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.code,'PT409');
 const d=await detail('customerA',id);assert.ok((d.job.status==='in_progress'&&d.cancellations.length===0)||(d.job.status==='ready'&&d.cancellations.length===1));
 });
 await check('S04 concurrent completion versus claim preserves one transition',async()=>{
 const id=await newJob();await coordinate(id);await pilot(id);await rpc(tech,id,'prepare');await rpc(tech,id,'start');await rpc(tech,id,'report_completion',{message:'Synthetic completion for concurrency regression'});const rev=(await detail('customerA',id)).job.revision;
 const results=await Promise.allSettled([rpc('customerA',id,'confirm_completion',{},rev),rpc(tech,id,'open_incident',{kind:'scope',description:'Synthetic discrepancy while confirmation is being requested.'},rev)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.code,'PT409');
 });
 await check('S04 professional suspension retains history but revokes schedule and address',async()=>{
 await admin.query("update public.technician_profiles set status='suspended'where user_id=$1",[actors[tech].id]);const d=await detail(tech,executable);assert.equal(d.job.status,'completed');assert.equal(d.can_operate,false);assert.equal(d.address,null);
 await assert.rejects(()=>rpc(tech,executable,'propose_schedule',futureWindow()),{code:'42501'});
 await admin.query("update public.technician_profiles set status='active'where user_id=$1",[actors[tech].id]);
 });
 await check('S04 moderator sees history but cannot impersonate a participant or enable execution',async()=>{
 assert.equal((await detail('moderator',executable)).job.id,executable);
 await assert.rejects(()=>rpc('moderator',executable,'start'),{code:'42501'});
 await assert.rejects(()=>actors.moderator.client.query("update private.job_execution_policies set mode='authorized_pilot'where job_id=$1",[executable]),{code:'42501'});
 });
 await check('S04 accept versus alternative serializes; completion replay emits one event',async()=>{
 const id=await newJob();await rpc(tech,id,'propose_schedule',futureWindow());let d=await detail('customerA',id);const proposalId=d.schedules.find(s=>s.state==='proposed').id;
 const r=await Promise.allSettled([rpc('customerA',id,'accept_schedule',{proposalId},d.job.revision),rpc(tech,id,'propose_schedule',futureWindow(),d.job.revision)]);
 assert.equal(r.filter(x=>x.status==='fulfilled').length,1);assert.equal(r.find(x=>x.status==='rejected').reason.code,'PT409');
 d=await detail('customerA',id);if(d.job.status!=='scheduled')await rpc('customerA',id,'accept_schedule',{proposalId:d.schedules.find(s=>s.state==='proposed').id});
 await pilot(id);await rpc(tech,id,'prepare');await rpc(tech,id,'start');d=await detail(tech,id);const op=randomUUID(),p={message:'Synthetic completion retry after lost network response'};
 const receipt=await rpc(tech,id,'report_completion',p,d.job.revision,op);assert.deepEqual(await rpc(tech,id,'report_completion',p,d.job.revision,op),receipt);
 assert.equal((await detail(tech,id)).history.filter(e=>e.action==='report_completion').length,1);
 const c=await rpc('customerA',id,'request_cancellation',{reason:'Synthetic sensitive cancellation after execution'});
 await assert.rejects(()=>rpc('moderator',id,'resolve_cancellation',{cancellationId:c.resource_id,decision:'approved',reason:'Synthetic approval blocked pending commercial policy'}),{code:'42501'});
 assert.equal((await detail('customerA',id)).cancellations[0].state,'pending');
 });
 await check('S04 evidence is private, replay-safe and frozen after incident resolution',async()=>{
 const id=await newJob(),i=(await rpc('customerA',id,'open_incident',{kind:'quality',description:'Synthetic private evidence registration and authorization test.'})).resource_id,a=randomUUID(),path=actors.customerA.id+'/'+i+'/'+a+'.jpg';
 await admin.query("insert into storage.objects(bucket_id,name)values('job-incident-evidence',$1)",[path]);
 const register=()=>call('customerA','select public.job_register_evidence($1,$2,$3,100) value',[i,a,'c'.repeat(64)]);await register();await register();
 assert.equal((await call('customerA','select public.job_evidence($1) value',[i])).length,1);assert.deepEqual(await call('customerB','select public.job_evidence($1) value',[i]),[]);
 assert.equal((await actors[otherTech].client.query("select * from storage.objects where name=$1",[path])).rowCount,0);
 await rpc('moderator',id,'resolve_incident',{incidentId:i,message:'Synthetic evidence case resolved without financial effect'});
 await assert.rejects(register,{code:'42501'});
 });
 await check('S04 outbox leases, worker authorization, retries and accepted != delivered',async()=>{
 await assert.rejects(()=>customer('select public.claim_job_notification() value'),{code:'42501'});
 const worker=server.getPgClient('postgres','127.0.0.1');await worker.connect();clients.push(worker);await worker.query('set role service_role');await worker.query("select set_config('request.jwt.claims','{\"role\":\"service_role\"}',false)");
 const first=(await worker.query('select public.claim_job_notification() value')).rows[0].value,second=(await worker.query('select public.claim_job_notification() value')).rows[0].value;assert.notEqual(first.id,second.id);
 await assert.rejects(()=>worker.query("select public.finish_job_notification($1,$2,'captured')",[first.id,randomUUID()]),{code:'PT409'});
 await assert.rejects(()=>worker.query("select public.finish_job_notification($1,$2,'delivered')",[first.id,first.lease_token]),{code:'22023'});
 await worker.query("select public.finish_job_notification($1,$2,'accepted','synthetic-provider')",[first.id,first.lease_token]);await worker.query("select public.finish_job_notification($1,$2,'accepted','synthetic-provider')",[first.id,first.lease_token]);
 const state=(await admin.query('select state,delivered_at from private.notification_outbox where id=$1',[first.id])).rows[0];assert.equal(state.state,'accepted');assert.equal(state.delivered_at,null);
 await worker.query("select public.finish_job_notification($1,$2,'retry')",[second.id,second.lease_token]);const retry=(await admin.query('select state,available_at>now() backoff from private.notification_outbox where id=$1',[second.id])).rows[0];assert.equal(retry.state,'pending');assert.equal(retry.backoff,true);
 const other=server.getPgClient('postgres','127.0.0.1');await other.connect();clients.push(other);await other.query('set role service_role');await other.query("select set_config('request.jwt.claims','{\"role\":\"service_role\"}',false)");
 const claims=await Promise.all([worker.query('select public.claim_job_notification() value'),other.query('select public.claim_job_notification() value')]);const leases=claims.map(r=>r.rows[0].value);assert.notEqual(leases[0].id,leases[1].id);
 await admin.query("update private.notification_outbox set lease_until=now()-interval '1 second',attempts=5 where id=$1",[leases[0].id]);
 await assert.rejects(()=>worker.query("select public.finish_job_notification($1,$2,'captured')",[leases[0].id,leases[0].lease_token]),{code:'PT409'});
 await worker.query('select public.claim_job_notification() value');assert.equal((await admin.query('select state from private.notification_outbox where id=$1',[leases[0].id])).rows[0].state,'dead');
 });
}
