// Sprint 05 SQL tests on a local embedded PostgreSQL. Auth/Storage are contract fixtures, Flow is NOT contacted:
// observations below are synthetic inputs to the DB boundary, never evidence of Flow Sandbox behaviour.
import assert from 'node:assert/strict';
import {randomUUID}from'node:crypto';

export async function runPaymentTests({admin,actors,server,clients,check,call,customer,quotePayload,payload}){
 const tech='technicianA',Q=25000,F=1250,T=26250;
 const worker=async()=>{const c=server.getPgClient('postgres','127.0.0.1');await c.connect();clients.push(c);await c.query('set role service_role');await c.query("select set_config('request.jwt.claims','{\"role\":\"service_role\"}',false)");return c;};
 const w=await worker(),w2=await worker();
 const wcall=(c,sql,args=[])=>c.query(sql,args).then(r=>r.rows[0]?.value);
 const detail=(label,id)=>call(label,'select public.job_detail($1) value',[id]);
 const rpc=async(label,id,action,value={})=>call(label,'select public.job_command($1,$2,$3,$4,$5) value',[id,randomUUID(),(await detail(label,id)).job.revision,action,value]);
 const futureWindow=()=>{const start=new Date(Date.now()+172800000);start.setUTCHours(15,0,0,0);const end=new Date(start.getTime()+2*3600000);const p=d=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d).map(x=>[x.type,x.value]));const s=p(start),e=p(end);return{startsAt:start.toISOString(),endsAt:end.toISOString(),localDate:s.year+'-'+s.month+'-'+s.day,startTime:s.hour+':'+s.minute,endTime:e.hour+':'+e.minute,reason:'Synthetic coordination proposal'};};
 async function newJob(){await admin.query("update public.service_requests set created_at=now()-interval '3 days' where customer_id=$1",[actors.customerA.id]);const r=await customer('select public.marketplace_create_request($1,$2) value',[randomUUID(),payload]);let q=await call(tech,'select public.marketplace_save_quote($1,$2,$3) value',[r.id,randomUUID(),quotePayload]);q=await call(tech,"select public.marketplace_transition_quote($1,'submitted',$2) value",[q.id,q.revision]);return(await customer('select public.marketplace_accept_quote($1,$2,$3) value',[r.id,q.id,q.revision])).job.id;}
 async function schedule(id){await rpc(tech,id,'propose_schedule',futureWindow());const d=await detail('customerA',id);await rpc('customerA',id,'accept_schedule',{proposalId:d.schedules.find(p=>p.state==='proposed').id});}
 const current=async()=>(await admin.query('select max(version)::int v from private.payment_pricing_policies')).rows[0].v;
 const prepare=async(label,id,extra=null,version=null,consent=true,key=randomUUID())=>call(label,'select public.payment_prepare($1,$2,$3,$4,$5) value',[id,extra,version??await current(),consent,key]);
 let n=0;const observe=async(c,attempt,{key=`evt-${attempt}-${++n}`,flow=7001,commerce,status=2,amount,currency='CLP',fee=null}={})=>{if(amount===undefined)amount=attempt?Number((await admin.query('select o.total_clp from private.payment_orders o join private.payment_attempts a on a.order_id=o.id where a.id=$1',[attempt])).rows[0].total_clp):T;return wcall(c,'select public.payment_apply_observation($1,$2,$3,$4,$5,$6,$7,$8,now()) value',[attempt,key,flow,commerce,status,amount,currency,fee]);};
 const state=async id=>(await admin.query('select payment_state from public.jobs where id=$1',[id])).rows[0].payment_state;
 const outbox=async(id,action)=>(await admin.query('select count(*)::int n from private.notification_outbox o join private.job_events e on e.id=o.event_id where e.job_id=$1 and e.action=$2',[id,action])).rows[0].n;
 const checkout=async(p,flowId)=>{await wcall(w,'select public.payment_attempt_begin_create($1) value',[p.attempt_id]);await wcall(w,'select public.payment_attempt_set_checkout($1,$2,$3,$4) value',[p.attempt_id,flowId,Buffer.from('ciphertext'),'test-key']);};
 // claim_due legitimately returns the OLDEST due work. Leftover attempts from earlier checks may become due depending on run speed, so checks that expect a specific
 // attempt first push every other one out of the way (test isolation only; no production behaviour is relaxed).
 const isolate=id=>admin.query("update private.payment_attempts set next_check_at=now()+interval '1 day' where id<>$1",[id]);
 let flow=7000;const T_of=p=>p.total_clp;
 // Sandbox payments exist only for explicitly authorized synthetic accounts (database-enforced). The suite's customer is one; customerB deliberately is not.
 await check('S05 Sandbox allowlist: only a superadmin authorizes synthetic accounts; a non-authorized customer cannot prepare; revocation takes effect immediately',async()=>{
  const j0=await newJob();const v0=await current();
  await assert.rejects(()=>call('customerA','select public.payment_prepare($1,null,$2,true,$3) value',[j0,v0,randomUUID()]),{code:'42501'});
  assert.equal((await admin.query('select count(*)::int n from private.payment_orders where job_id=$1',[j0])).rows[0].n,0);
  assert.equal((await call('customerA','select public.job_payments($1) value',[j0])).sandbox_enabled,false);
  for(const label of['customerA','moderator',tech])await assert.rejects(()=>call(label,'select public.payment_sandbox_account_set($1,true,$2) value',[actors.customerA.id,'Intento sin permiso de superadmin']),{code:'42501'});
  await assert.rejects(()=>call('admin','select public.payment_sandbox_account_set($1,true,$2) value',[actors.customerA.id,'corto']),{code:'22023'});
  await assert.rejects(()=>call('admin','select public.payment_sandbox_account_set($1,true,$2) value',[randomUUID(),'Cuenta inexistente para la prueba']),{code:'22023'});
  await admin.query("update auth.users set email='real.person@example.com' where id=$1",[actors.customerB.id]);
  await assert.rejects(()=>call('admin','select public.payment_sandbox_account_set($1,true,$2) value',[actors.customerB.id,'Correo enrutable, no sintético']),{code:'PT409'});
  await admin.query("update auth.users set email='customerB@local.invalid' where id=$1",[actors.customerB.id]);
  assert.equal((await call('admin','select public.payment_sandbox_account_set($1,true,$2) value',[actors.customerA.id,'Cuenta sintética de la suite S05'])).enabled,true);
  assert.equal((await call('customerA','select public.job_payments($1) value',[j0])).sandbox_enabled,true);
  assert.equal(((await call('moderator','select public.payment_admin_overview() value')).sandbox_accounts).some(a=>a.user_id===actors.customerA.id&&a.active),true);
  // Revocation is immediate; an authorized account whose email stops being synthetic loses access too (defence in depth).
  await call('admin','select public.payment_sandbox_account_set($1,false,$2) value',[actors.customerA.id,'Revocación de prueba de la suite S05']);
  await assert.rejects(()=>call('customerA','select public.payment_prepare($1,null,$2,true,$3) value',[j0,v0,randomUUID()]),{code:'42501'});
  await call('admin','select public.payment_sandbox_account_set($1,true,$2) value',[actors.customerA.id,'Reautorización de la suite S05']);
  await admin.query("update auth.users set email='customerA@example.com' where id=$1",[actors.customerA.id]);
  await assert.rejects(()=>call('customerA','select public.payment_prepare($1,null,$2,true,$3) value',[j0,v0,randomUUID()]),{code:'42501'});
  await admin.query("update auth.users set email='customerA@local.invalid' where id=$1",[actors.customerA.id]);
  assert.ok((await call('customerA','select public.payment_prepare($1,null,$2,true,$3) value',[j0,v0,randomUUID()])).order_id);
  // History: the current row is only the current state; every change is an immutable event with actor and reason.
  const ev=(await admin.query("select action,reason,actor_id from private.payment_sandbox_account_events where user_id=$1 order by created_at,id",[actors.customerA.id])).rows;
  assert.deepEqual(ev.map(e=>e.action),['authorized','revoked','reauthorized']);
  assert.ok(ev.every(e=>e.actor_id===actors.admin.id&&e.reason.length>=10));assert.equal(ev[1].reason,'Revocación de prueba de la suite S05');
  await call('admin','select public.payment_sandbox_account_set($1,false,$2) value',[actors.customerA.id,'Revocación para comprobar el motivo vigente']);
  await call('admin','select public.payment_sandbox_account_set($1,false,$2) value',[actors.customerA.id,'Segunda revocación que no debe registrarse']);
  assert.equal((await admin.query("select count(*)::int n from private.payment_sandbox_account_events where user_id=$1 and action='revoked'",[actors.customerA.id])).rows[0].n,2);
  assert.equal((await admin.query('select revoke_reason r from private.payment_sandbox_accounts where user_id=$1',[actors.customerA.id])).rows[0].r,'Revocación para comprobar el motivo vigente');
  await call('admin','select public.payment_sandbox_account_set($1,true,$2) value',[actors.customerA.id,'Reautorización para continuar la suite S05']);
  assert.equal((await admin.query('select revoke_reason r from private.payment_sandbox_accounts where user_id=$1',[actors.customerA.id])).rows[0].r,null);
  await assert.rejects(()=>admin.query("update private.payment_sandbox_account_events set reason='x padding padding'"),{code:'PT409'});
  await assert.rejects(()=>admin.query('delete from private.payment_sandbox_account_events'),{code:'PT409'});
 });
 await check('S05 Sandbox allowlist is re-checked before reserving (worker) and before reopening a checkout: a revoked customer cannot reach Flow',async()=>{
  const j=await newJob();await schedule(j);const p=await prepare('customerA',j);
  await call('admin','select public.payment_sandbox_account_set($1,false,$2) value',[actors.customerA.id,'Revocación entre prepare y reserva']);
  await assert.rejects(()=>wcall(w,'select public.payment_attempt_begin_create($1) value',[p.attempt_id]),{code:'PT409'});
  assert.equal((await admin.query('select state from private.payment_attempts where id=$1',[p.attempt_id])).rows[0].state,'prepared');   // never reserved, so never sent to Flow
  await call('admin','select public.payment_sandbox_account_set($1,true,$2) value',[actors.customerA.id,'Reautorización tras la prueba de reserva']);
  await checkout(p,++flow);
  await call('admin','select public.payment_sandbox_account_set($1,false,$2) value',[actors.customerA.id,'Revocación antes de reabrir el checkout']);
  await assert.rejects(()=>wcall(w,'select public.payment_attempt_checkout($1,$2) value',[p.attempt_id,actors.customerA.id]),{code:'PT409'});
  await call('admin','select public.payment_sandbox_account_set($1,true,$2) value',[actors.customerA.id,'Reautorización final de la prueba']);
  assert.ok((await wcall(w,'select public.payment_attempt_checkout($1,$2) value',[p.attempt_id,actors.customerA.id])).ciphertext);
 });

 await check('S05 fee policy: 5 % seeded, versioned superadmin edit, moderator denied, invalid input rejected',async()=>{
  assert.deepEqual(await call('customerA','select public.payment_policy_current() value'),{version:1,fee_basis_points:500});
  await assert.rejects(()=>call('moderator','select public.payment_policy_set(1,300,$1) value',['Intento de moderador sin permiso']),{code:'42501'});
  await assert.rejects(()=>call('customerA','select public.payment_policy_set(1,300,$1) value',['Intento de cliente sin permiso']),{code:'42501'});
  await assert.rejects(()=>call('admin','select public.payment_policy_set(1,5000,$1) value',['Porcentaje fuera de rango']),{code:'22023'});
  await assert.rejects(()=>call('admin','select public.payment_policy_set(1,500,$1) value',['corto']),{code:'22023'});
  await assert.rejects(()=>actors.admin.client.query('update private.payment_pricing_policies set fee_basis_points=0'),{code:'42501'});
 });

 let job,p1;
 await check('S05 consent + frozen Q/F/T; not_enabled until an order exists; only the owning customer prepares',async()=>{
  job=await newJob();assert.equal(await state(job),'not_enabled');await schedule(job);
  await assert.rejects(()=>prepare('customerA',job,null,1,false),{code:'22023'});
  await assert.rejects(()=>prepare('customerA',job,null,9),{code:'PT409'});
  await assert.rejects(()=>prepare(tech,job),{code:'42501'});
  await assert.rejects(()=>prepare('customerB',job),{code:'42501'});
  await assert.rejects(()=>prepare('moderator',job),{code:'42501'});
  const key=randomUUID();p1=await prepare('customerA',job,null,1,true,key);
  assert.equal(p1.professional_amount_clp,Q);assert.equal(p1.platform_fee_clp,F);assert.equal(p1.total_clp,T);assert.equal(p1.attempt_state,'prepared');
  assert.deepEqual(await prepare('customerA',job,null,1,true,key),p1);
  assert.equal(await state(job),'payment_pending');
  assert.equal((await prepare('customerA',job)).attempt_id,p1.attempt_id);
  const row=(await admin.query('select snapshot_sha256,consent_by from private.payment_orders where id=$1',[p1.order_id])).rows[0];assert.match(row.snapshot_sha256,/^[0-9a-f]{64}$/);assert.equal(row.consent_by,actors.customerA.id);
 });
 await check('S05 null policy version never skips the consent check',async()=>{
  const j=await newJob();await assert.rejects(()=>call('customerA','select public.payment_prepare($1,null,null,true,$2) value',[j,randomUUID()]),{code:'22023'});
  assert.equal((await admin.query('select count(*)::int n from private.payment_orders where job_id=$1',[j])).rows[0].n,0);
 });
 await check('S05 payment_state cannot be forged; terms immutable; browser has no table or worker-RPC access',async()=>{
  await assert.rejects(()=>admin.query("update public.jobs set payment_state='paid',revision=revision+1 where id=$1",[job]),{code:'PT409'});
  await assert.rejects(()=>admin.query('update private.payment_orders set total_clp=total_clp-1000,professional_amount_clp=professional_amount_clp-1000 where id=$1',[p1.order_id]),{code:'PT409'});
  await assert.rejects(()=>actors.customerA.client.query('select * from private.payment_orders'),{code:'42501'});
  await assert.rejects(()=>actors.customerA.client.query("insert into private.payment_events(provider_event_key,observed_status,validation)values('forged-event',2,'applied')"),{code:'42501'});
  await assert.rejects(()=>call('customerA','select public.payment_apply_observation(null,$1,1,$1,2,1,$1,null,now()) value',['x']),{code:'42501'});
  await assert.rejects(()=>call('customerA','select public.payment_inbox_claim() value'),{code:'42501'});
  await assert.rejects(()=>call('customerA','select public.payment_attempt_claim_due() value'),{code:'42501'});
 });
 await check('S05 reopening: a pending checkout is reused by the owner only; creating/review still block; roles cannot read it',async()=>{
  const j=await newJob();await schedule(j);const p=await prepare('customerA',j);
  await wcall(w,'select public.payment_attempt_begin_create($1) value',[p.attempt_id]);
  await assert.rejects(()=>prepare('customerA',j),{code:'PT409'});
  await assert.rejects(()=>wcall(w,'select public.payment_attempt_checkout($1,$2) value',[p.attempt_id,actors.customerA.id]),{code:'PT409'});
  await wcall(w,'select public.payment_attempt_set_checkout($1,$2,$3,$4) value',[p.attempt_id,++flow,Buffer.from('ciphertext'),'test-key']);
  const again=await prepare('customerA',j);assert.equal(again.attempt_id,p.attempt_id);assert.equal(again.attempt_state,'pending');
  assert.equal((await admin.query('select count(*)::int n from private.payment_attempts where order_id=$1',[p.order_id])).rows[0].n,1);
  const got=await wcall(w,'select public.payment_attempt_checkout($1,$2) value',[p.attempt_id,actors.customerA.id]);
  assert.equal(got.key_id,'test-key');assert.equal(got.ciphertext,Buffer.from('ciphertext').toString('hex'));
  for(const who of [actors.customerB.id,actors[tech].id,randomUUID(),null])await assert.rejects(()=>wcall(w,'select public.payment_attempt_checkout($1,$2) value',[p.attempt_id,who]),{code:'PT409'});
  await assert.rejects(()=>wcall(w,'select public.payment_attempt_checkout($1,$2) value',[randomUUID(),actors.customerA.id]),{code:'PT409'});
  for(const label of ['customerA','customerB',tech,'moderator','admin'])await assert.rejects(()=>call(label,'select public.payment_attempt_checkout($1,$2) value',[p.attempt_id,actors.customerA.id]),{code:'42501'});
  await observe(w,p.attempt_id,{flow,commerce:p.commerce_order,amount:Q});
  await assert.rejects(()=>wcall(w,'select public.payment_attempt_checkout($1,$2) value',[p.attempt_id,actors.customerA.id]),{code:'PT409'});
  await assert.rejects(()=>prepare('customerA',j),{code:'PT409'});
 });
 await check('S05 mismatched amount/currency/reference never pays; unknown identity quarantined',async()=>{
  const j=await newJob();await schedule(j);const p=await prepare('customerA',j);await checkout(p,++flow);
  assert.equal((await observe(w,p.attempt_id,{flow,commerce:p.commerce_order,amount:Q})).validation,'mismatch');
  const o=(await admin.query('select status,review_reason from private.payment_orders where id=$1',[p.order_id])).rows[0];assert.equal(o.status,'awaiting_payment');assert.equal(o.review_reason,'provider_mismatch');
  assert.equal(await state(j),'payment_review');
  await assert.rejects(()=>prepare('customerA',j),{code:'PT409'});
  const j2=await newJob();await schedule(j2);const p2=await prepare('customerA',j2);await checkout(p2,++flow);
  assert.equal((await observe(w,p2.attempt_id,{flow,commerce:'fixo-sandbox-'+randomUUID()})).validation,'mismatch');
  assert.equal((await observe(w,null,{flow:999,commerce:'fixo-sandbox-unknown'})).validation,'unknown_identity');
  assert.equal((await admin.query("select count(*)::int n from private.payment_orders where status='paid' and id in($1,$2)",[p.order_id,p2.order_id])).rows[0].n,0);
  assert.equal(await state(j2),'payment_review');
 });
 await check('S05 verified paid applies once: event + projection + provider outbox, replay/concurrency deduplicated, later states never revert',async()=>{
  await checkout(p1,++flow);
  assert.equal((await observe(w,p1.attempt_id,{flow,commerce:p1.commerce_order,status:1,key:'pending-event-1'})).result,'pending');
  assert.equal(await state(job),'payment_pending');
  const results=await Promise.all([observe(w,p1.attempt_id,{flow,commerce:p1.commerce_order,key:'paid-event-1',fee:300}),observe(w2,p1.attempt_id,{flow,commerce:p1.commerce_order,key:'paid-event-1',fee:300})]);
  assert.deepEqual(results.map(r=>r.result).sort(),['applied','duplicate']);
  assert.equal(await state(job),'paid');assert.equal(await outbox(job,'payment_confirmed'),2);
  assert.equal((await observe(w,p1.attempt_id,{flow,commerce:p1.commerce_order,key:'paid-event-1'})).result,'duplicate');
  assert.equal((await observe(w,p1.attempt_id,{flow,commerce:p1.commerce_order,status:3,key:'late-reject-1'})).result,'stale');
  assert.equal(await state(job),'paid');
  const ev=(await admin.query("select source,actor_id,payment_event_id from private.job_events where job_id=$1 and action='payment_confirmed'",[job])).rows;assert.equal(ev.length,1);assert.equal(ev[0].source,'provider');assert.equal(ev[0].actor_id,null);assert.ok(ev[0].payment_event_id);
  assert.equal(Number((await admin.query('select flow_cost_clp from private.payment_orders where id=$1',[p1.order_id])).rows[0].flow_cost_clp),300);
  await assert.rejects(()=>prepare('customerA',job),{code:'PT409'});
  const view=await call('customerA','select public.job_payments($1) value',[job]);assert.equal(view.orders[0].total_clp,T);assert.equal(view.orders[0].simulated_settlement_clp,null);
  const tview=await call(tech,'select public.job_payments($1) value',[job]);assert.equal(tview.orders[0].professional_amount_clp,Q);assert.equal(tview.orders[0].total_clp,null);assert.equal(tview.orders[0].platform_fee_clp,null);
  assert.equal(await call('customerB','select public.job_payments($1) value',[job]),null);
 });
 await check('S05 execution needs verified payment AND an explicit superadmin Sandbox window for that job',async()=>{
  const j=await newJob();await schedule(j);await assert.rejects(()=>rpc(tech,j,'prepare'),{code:'42501'});
  await assert.rejects(()=>call('moderator','select public.payment_enable_sandbox_job($1,24,$2) value',[j,'Moderador no puede habilitar']),{code:'42501'});
  await call('admin','select public.payment_enable_sandbox_job($1,24,$2) value',[j,'Prueba Sandbox aislada autorizada']);
  await assert.rejects(()=>rpc(tech,j,'prepare'),{code:'42501'});
  await assert.rejects(()=>rpc(tech,job,'prepare'),{code:'42501'});
  await call('admin','select public.payment_enable_sandbox_job($1,24,$2) value',[job,'Prueba Sandbox aislada autorizada']);
  await rpc(tech,job,'prepare');await rpc(tech,job,'start');assert.equal((await detail('customerA',job)).job.status,'in_progress');
 });
 let extra,pe;
 await check('S05 extras: only assigned professional proposes, only customer accepts, frozen terms, completion blocked until paid',async()=>{
  await assert.rejects(()=>call('customerA','select public.job_extra_propose($1,$2,$3,$4) value',[job,randomUUID(),'Cliente no puede proponer',5000]),{code:'42501'});
  await assert.rejects(()=>call('technicianB','select public.job_extra_propose($1,$2,$3,$4) value',[job,randomUUID(),'Profesional ajeno no puede',5000]),{code:'42501'});
  extra=(await call(tech,'select public.job_extra_propose($1,$2,$3,$4) value',[job,randomUUID(),'Reemplazo adicional de sifón',10001])).id;
  await assert.rejects(()=>call(tech,'select public.job_extra_respond($1,$2,1) value',[extra,'accepted']),{code:'42501'});
  await assert.rejects(()=>prepare('customerA',job,extra),{code:'PT409'});
  await call('admin','select public.payment_policy_set(1,1000,$1) value',['Cambio de prueba para verificar congelamiento']);
  await assert.rejects(()=>call('customerA','select public.job_extra_respond($1,$2,1) value',[extra,'accepted']),{code:'PT409'});
  await assert.rejects(()=>call('customerA','select public.job_extra_respond($1,$2,null) value',[extra,'accepted']),{code:'22023'});
  const accepted=await call('customerA','select public.job_extra_respond($1,$2,2) value',[extra,'accepted']);assert.ok(accepted.order_id);
  const order=(await admin.query('select fee_basis_points,platform_fee_clp,total_clp from private.payment_orders where extra_charge_id=$1',[extra])).rows[0];
  assert.equal(order.fee_basis_points,1000);assert.equal(Number(order.platform_fee_clp),1000);assert.equal(Number(order.total_clp),11001);
  assert.equal((await admin.query('select fee_basis_points from private.payment_orders where id=$1',[p1.order_id])).rows[0].fee_basis_points,500);
  await assert.rejects(()=>admin.query('update private.job_extra_charges set amount_clp=1000 where id=$1',[extra]),{code:'PT409'});
  await rpc(tech,job,'report_completion',{message:'Trabajo realizado, queda un adicional por pagar'});
  await assert.rejects(()=>rpc('customerA',job,'confirm_completion'),{code:'PT409'});
  assert.equal((await call('customerA','select public.job_payments($1) value',[job])).unpaid_extras,true);assert.equal(await state(job),'paid');
  pe=await prepare('customerA',job,extra,2);assert.equal(pe.total_clp,11001);await checkout(pe,++flow);
  await observe(w,pe.attempt_id,{flow,commerce:pe.commerce_order,amount:11001});
  assert.equal((await rpc('customerA',job,'confirm_completion')).status,'completed');
  const settled=await call('customerA','select public.job_payments($1) value',[job]);assert.equal(settled.unpaid_extras,false);assert.ok(settled.orders.every(o=>o.simulated_settlement_clp>0));
  await assert.rejects(()=>call(tech,'select public.job_extra_propose($1,$2,$3,$4) value',[job,randomUUID(),'Adicional tras el cierre del trabajo',5000]),{code:'PT409'});
 });
 await check('S05 duplicate external payment is preserved as an anomaly without duplicating assignment or notices',async()=>{
  const j=await newJob();await schedule(j);const a1=await prepare('customerA',j);await wcall(w,'select public.payment_attempt_begin_create($1) value',[a1.attempt_id]);
  await wcall(w,'select public.payment_attempt_mark_ambiguous($1,$2) value',[a1.attempt_id,'timeout']);
  await assert.rejects(()=>prepare('customerA',j),{code:'PT409'});
  await admin.query("update private.payment_attempts set state='failed' where id=$1",[a1.attempt_id]);
  const a2=await prepare('customerA',j);assert.notEqual(a2.attempt_id,a1.attempt_id);assert.notEqual(a2.commerce_order,a1.commerce_order);
  await checkout(a2,++flow);
  assert.equal((await observe(w,a2.attempt_id,{flow,commerce:a2.commerce_order})).result,'applied');
  assert.equal((await observe(w,a1.attempt_id,{flow:++flow,commerce:a1.commerce_order,key:'dup-event-1'})).result,'duplicate_payment');
  assert.equal(await state(j),'payment_review');assert.equal(await outbox(j,'payment_confirmed'),2);
  const dup=async()=>(await admin.query('select state,flow_order::text fo,check_count,lease_token from private.payment_attempts where id=$1',[a1.attempt_id])).rows[0];
  assert.deepEqual({s:(await dup()).state,fo:(await dup()).fo},{s:'paid',fo:String(flow)});
  const reviews=async()=>(await admin.query("select count(*)::int n from private.job_events e where e.job_id=$1 and e.action='payment_review_required'",[j])).rows[0].n;
  const noticed=await reviews();assert.equal(noticed,1);
  // A different observation of the same duplicate payment, even with a fee: no second notice, no re-poll, fee never feeds the order cost.
  assert.equal((await observe(w,a1.attempt_id,{flow,commerce:a1.commerce_order,key:'dup-event-2',fee:999})).result,'stale');
  assert.equal(await reviews(),noticed);
  assert.equal((await admin.query('select flow_cost_clp from private.payment_orders where id=$1',[a1.order_id])).rows[0].flow_cost_clp,null);
  assert.equal((await wcall(w,'select public.payment_attempt_claim_due() value')?.catch(()=>null))?.attempt_id===a1.attempt_id,false);
  // The original paid attempt can still complete the order cost afterwards.
  assert.equal((await observe(w,a2.attempt_id,{flow:flow-1,commerce:a2.commerce_order,key:'orig-cost-1',fee:700})).result,'cost_updated');
  assert.equal(Number((await admin.query('select flow_cost_clp from private.payment_orders where id=$1',[a1.order_id])).rows[0].flow_cost_clp),700);
  assert.equal(await reviews(),noticed);
  assert.equal((await admin.query("select count(*)::int n from private.payment_orders where job_id=$1 and status='paid'",[j])).rows[0].n,1);
  assert.equal((await call('admin','select public.payment_admin_overview() value')).reviews.some(r=>r.job_id===j&&r.reason==='duplicate_payment'),true);
  await call('admin','select public.payment_enable_sandbox_job($1,24,$2) value',[j,'Prueba Sandbox aislada autorizada']);
  await assert.rejects(()=>rpc(tech,j,'prepare'),{code:'42501'});
 });
 await check('S05 late payment after cancellation is recorded for review without reactivating the job',async()=>{
  const j=await newJob();const p=await prepare('customerA',j);await checkout(p,++flow);
  await admin.query("update public.jobs set status='cancelled',revision=revision+1 where id=$1",[j]);
  assert.equal((await observe(w,p.attempt_id,{flow,commerce:p.commerce_order})).result,'late_payment');
  assert.equal((await detail('customerA',j)).job.status,'cancelled');assert.equal(await state(j),'payment_review');
 });
 await check('S05 payment during a pending cancellation is kept as paid but sent to review (same lock, no normal confirmation)',async()=>{
  const j=await newJob();await schedule(j);const p=await prepare('customerA',j);await checkout(p,++flow);
  await admin.query("insert into private.job_cancellations(job_id,actor_id,reason,previous_state)values($1,$2,'Solicitud de cancelación sintética',(select status from public.jobs where id=$1))",[j,actors.customerA.id]);
  assert.equal((await observe(w,p.attempt_id,{flow,commerce:p.commerce_order})).result,'late_payment');
  const o=(await admin.query('select status,review_reason from private.payment_orders where id=$1',[p.order_id])).rows[0];assert.equal(o.status,'paid');assert.equal(o.review_reason,'cancellation_pending');
  assert.equal(await state(j),'payment_review');assert.equal(await outbox(j,'payment_confirmed'),0);
  assert.equal((await admin.query("select count(*)::int n from private.payment_events where attempt_id=$1 and validation='late_payment'",[p.attempt_id])).rows[0].n,1);
 });
 const cancelJob=async(j,label)=>{const r=await rpc('customerA',j,'request_cancellation',{reason:'Solicitud de cancelación sintética '+label});return rpc('admin',j,'resolve_cancellation',{cancellationId:r.resource_id,decision:'approved',reason:'Cancelación aprobada en la prueba '+label});};
 const reviewNotices=async j=>(await admin.query("select count(*)::int n from private.job_events e where e.job_id=$1 and e.action='payment_review_required'",[j])).rows[0].n;
 await check('S05 cancellation AFTER a verified payment (real RPCs): order stays paid, goes to review once, one notice per participant, replays change nothing',async()=>{
  const j=await newJob();await schedule(j);const p=await prepare('customerA',j);await checkout(p,++flow);
  assert.equal((await observe(w,p.attempt_id,{flow,commerce:p.commerce_order})).result,'applied');assert.equal(await state(j),'paid');
  await cancelJob(j,'después del pago');
  assert.equal((await detail('customerA',j)).job.status,'cancelled');
  const o=(await admin.query('select status,review_reason,paid_attempt_id from private.payment_orders where id=$1',[p.order_id])).rows[0];
  assert.equal(o.status,'paid');assert.equal(o.paid_attempt_id,p.attempt_id);assert.equal(o.review_reason,'job_cancelled');
  assert.equal(await state(j),'payment_review');
  assert.equal((await admin.query("select count(*)::int n from private.payment_events where order_id=$1 and validation='job_cancelled'",[p.order_id])).rows[0].n,1);
  assert.equal(await reviewNotices(j),1);assert.equal((await admin.query("select count(*)::int n from private.notification_outbox o join private.job_events e on e.id=o.event_id where e.job_id=$1 and e.action='payment_review_required'",[j])).rows[0].n,2);
  assert.equal((await call('admin','select public.payment_admin_overview() value')).reviews.some(r=>r.job_id===j&&r.reason==='job_cancelled'),true);
  // Callback/reconciliation replays: still paid, no second review event or notice, the Flow cost may still be completed.
  assert.equal((await observe(w,p.attempt_id,{flow,commerce:p.commerce_order,key:'cancel-replay-1',fee:300})).result,'cost_updated');
  assert.equal((await observe(w,p.attempt_id,{flow,commerce:p.commerce_order,key:'cancel-replay-2',fee:300})).result,'stale');
  assert.equal(await reviewNotices(j),1);assert.equal((await admin.query('select status from private.payment_orders where id=$1',[p.order_id])).rows[0].status,'paid');
  // Re-applying the cancelled status (owner statement) cannot duplicate the event.
  await admin.query("update public.jobs set status='cancelled',revision=revision+1 where id=$1",[j]);
  assert.equal((await admin.query("select count(*)::int n from private.payment_events where order_id=$1 and validation='job_cancelled'",[p.order_id])).rows[0].n,1);
  assert.equal(await reviewNotices(j),1);
 });
 await check('S05 cancellation BEFORE the payment is observed (real RPCs): payable order goes to review; the late payment stays paid, never reactivates the job',async()=>{
  const j=await newJob();await schedule(j);const p=await prepare('customerA',j);await checkout(p,++flow);
  await cancelJob(j,'antes del pago');
  const o1=(await admin.query('select status,review_reason from private.payment_orders where id=$1',[p.order_id])).rows[0];assert.deepEqual(o1,{status:'awaiting_payment',review_reason:'job_cancelled'});
  assert.equal(await state(j),'payment_review');
  await assert.rejects(()=>wcall(w,'select public.payment_attempt_checkout($1,$2) value',[p.attempt_id,actors.customerA.id]),{code:'PT409'});
  assert.equal((await observe(w,p.attempt_id,{flow,commerce:p.commerce_order})).result,'late_payment');
  const o2=(await admin.query('select status,review_reason from private.payment_orders where id=$1',[p.order_id])).rows[0];assert.deepEqual(o2,{status:'paid',review_reason:'job_cancelled'});
  assert.equal((await detail('customerA',j)).job.status,'cancelled');assert.equal(await state(j),'payment_review');assert.equal(await outbox(j,'payment_confirmed'),0);
 });
 await check('S05 cancelling a job without any payment order, or whose order is already final, creates no review',async()=>{
  const j=await newJob();await schedule(j);await cancelJob(j,'sin pago');
  assert.equal(await state(j),'not_enabled');assert.equal(await reviewNotices(j),0);
  const k=await newJob();await schedule(k);const p=await prepare('customerA',k);
  await admin.query("update private.payment_attempts set state='failed' where id=$1",[p.attempt_id]);
  await cancelJob(k,'intento fallido');
  assert.equal((await admin.query('select review_reason from private.payment_orders where id=$1',[p.order_id])).rows[0].review_reason,null);
  assert.equal(await reviewNotices(k),0);
 });
 await check('S05 a started job still needs a separate commercial policy to cancel (payments alone no longer block it)',async()=>{
  const j=await newJob();await schedule(j);
  await admin.query("update public.jobs set started_at=now(),revision=revision+1 where id=$1",[j]);
  const r=await rpc('customerA',j,'request_cancellation',{reason:'Solicitud sobre trabajo ya iniciado'});
  await assert.rejects(()=>rpc('admin',j,'resolve_cancellation',{cancellationId:r.resource_id,decision:'approved',reason:'Intento de cancelar un trabajo iniciado'}),{code:'42501'});
 });
 // Two overlapping transactions with explicit synchronisation: the second statement is observed WAITING on a lock (pg_stat_activity) before the first one commits.
 const waitBlocked=async(pattern)=>{for(let i=0;i<150;i++){const r=await admin.query("select count(*)::int n from pg_stat_activity where wait_event_type='Lock' and query like $1 and pid<>pg_backend_pid()",[pattern]);if(r.rows[0].n>0)return;await new Promise(r=>setTimeout(r,100));}throw new Error('no backend became blocked on '+pattern);};
 const eventCount=async(order,validation)=>(await admin.query('select count(*)::int n from private.payment_events where order_id=$1 and validation=$2',[order,validation])).rows[0].n;
 const noticesPerEvent=async j=>(await admin.query("select e.payment_event_id,count(o.*)::int n from private.job_events e join private.notification_outbox o on o.event_id=e.id where e.job_id=$1 and e.source='provider' group by e.payment_event_id",[j])).rows;
 const cancelCommand=async(j,label)=>{const r=await rpc('customerA',j,'request_cancellation',{reason:'Solicitud de cancelación sintética '+label});return{cancellationId:r.resource_id,revision:(await detail('customerA',j)).job.revision,reason:'Cancelación aprobada en la prueba '+label};};
 const resolveSql='select public.job_command($1,$2,$3,$4,$5) value';
 await check('S05 race: cancellation COMMITS first while the payment confirmation waits on the job lock -> late payment kept paid, in review, no duplicate effects',async()=>{
  const j=await newJob();await schedule(j);const p=await prepare('customerA',j);await checkout(p,++flow);
  const c=await cancelCommand(j,'carrera 1');const ac=actors.admin.client;
  await ac.query('begin');
  await ac.query(resolveSql,[j,randomUUID(),c.revision,'resolve_cancellation',{cancellationId:c.cancellationId,decision:'approved',reason:c.reason}]);   // holds the job lock, uncommitted
  const confirm=observe(w2,p.attempt_id,{flow,commerce:p.commerce_order});                                                                              // blocks behind the cancellation
  await waitBlocked('%payment_apply_observation%');
  assert.equal((await admin.query('select status from private.payment_orders where id=$1',[p.order_id])).rows[0].status,'awaiting_payment');       // nothing visible before commit
  await ac.query('commit');
  assert.equal((await confirm).result,'late_payment');
  const o=(await admin.query('select status,review_reason,paid_attempt_id from private.payment_orders where id=$1',[p.order_id])).rows[0];
  assert.deepEqual(o,{status:'paid',review_reason:'job_cancelled',paid_attempt_id:p.attempt_id});
  assert.equal((await detail('customerA',j)).job.status,'cancelled');assert.equal(await state(j),'payment_review');
  assert.equal(await eventCount(p.order_id,'job_cancelled'),1);assert.equal(await eventCount(p.order_id,'late_payment'),1);assert.equal(await outbox(j,'payment_confirmed'),0);
  const per=await noticesPerEvent(j);assert.equal(per.length,2);assert.ok(per.every(x=>x.n===2),'exactly one notice per participant per event');
  assert.equal((await admin.query("select count(*)::int n from private.payment_orders where job_id=$1 and status='paid'",[j])).rows[0].n,1);
 });
 await check('S05 race: the payment confirmation COMMITS first (during the pending cancellation request) while the resolution waits -> version conflict, retry keeps paid, one review, no duplicate effects',async()=>{
  const j=await newJob();await schedule(j);const p=await prepare('customerA',j);await checkout(p,++flow);
  const c=await cancelCommand(j,'carrera 2');const ac=actors.admin.client;
  await w2.query('begin');
  assert.equal((await observe(w2,p.attempt_id,{flow,commerce:p.commerce_order})).result,'late_payment');                                              // a pending cancellation request already exists: paid + review; holds the job lock, uncommitted
  const cancelling=ac.query(resolveSql,[j,randomUUID(),c.revision,'resolve_cancellation',{cancellationId:c.cancellationId,decision:'approved',reason:c.reason}]).then(r=>({ok:r.rows[0].value}),e=>({err:e}));
  await waitBlocked('%job_command%');
  await w2.query('commit');
  const first=await cancelling;
  assert.equal(first.err?.code,'PT409','the cancellation was prepared against the pre-payment revision: it must conflict, not overwrite');
  assert.equal((await detail('customerA',j)).job.status,'scheduled');                                                                                     // nothing half-applied
  const fresh=(await detail('customerA',j)).job.revision;assert.ok(fresh>c.revision);
  await ac.query(resolveSql,[j,randomUUID(),fresh,'resolve_cancellation',{cancellationId:c.cancellationId,decision:'approved',reason:c.reason}]);        // retry by version
  assert.equal((await detail('customerA',j)).job.status,'cancelled');
  const o=(await admin.query('select status,review_reason,paid_attempt_id from private.payment_orders where id=$1',[p.order_id])).rows[0];
  assert.deepEqual(o,{status:'paid',review_reason:'cancellation_pending',paid_attempt_id:p.attempt_id});assert.equal(await state(j),'payment_review');   // the order was already in review: the trigger must not add a second reason or event
  assert.equal(await eventCount(p.order_id,'late_payment'),1);assert.equal(await eventCount(p.order_id,'job_cancelled'),0);
  assert.equal(await outbox(j,'payment_confirmed'),0);assert.equal(await reviewNotices(j),1);
  const per=await noticesPerEvent(j);assert.equal(per.length,1);assert.ok(per.every(x=>x.n===2));
  // A replayed callback afterwards changes nothing.
  assert.equal((await observe(w,p.attempt_id,{flow,commerce:p.commerce_order,key:'race2-replay'})).result,'stale');
  assert.equal((await noticesPerEvent(j)).length,1);assert.equal(await eventCount(p.order_id,'job_cancelled'),0);
 });
 await check('S05 Sandbox allowlist race: two concurrent FIRST authorizations of the same account are serialized (authorized, then reauthorized); the current row stays single',async()=>{
  const target=actors.technicianB.id;
  assert.equal((await admin.query('select count(*)::int n from private.payment_sandbox_accounts where user_id=$1',[target])).rows[0].n,0);   // really a first authorization
  const adminClaims=(await actors.admin.client.query("select current_setting('request.jwt.claims') c")).rows[0].c;
  const second=server.getPgClient('postgres','127.0.0.1');await second.connect();clients.push(second);
  await second.query('set role authenticated');await second.query("select set_config('request.jwt.claims',$1,false)",[adminClaims]);
  const set=(c,reason)=>c.query('select public.payment_sandbox_account_set($1,true,$2) value',[target,reason]);
  await actors.admin.client.query('begin');
  await set(actors.admin.client,'Primera autorización concurrente de la cuenta');                                  // holds the per-account lock, uncommitted
  const pending=set(second,'Segunda autorización concurrente de la cuenta');                                        // must WAIT, not read "no row"
  await waitBlocked('%payment_sandbox_account_set%');
  assert.equal((await admin.query('select count(*)::int n from private.payment_sandbox_account_events where user_id=$1',[target])).rows[0].n,0);   // nothing visible before commit
  await actors.admin.client.query('commit');await pending;
  const ev=(await admin.query('select action,reason from private.payment_sandbox_account_events where user_id=$1 order by created_at,id',[target])).rows;
  assert.deepEqual(ev,[{action:'authorized',reason:'Primera autorización concurrente de la cuenta'},{action:'reauthorized',reason:'Segunda autorización concurrente de la cuenta'}]);
  const row=(await admin.query('select reason,revoked_at from private.payment_sandbox_accounts where user_id=$1',[target])).rows;
  assert.equal(row.length,1);assert.equal(row[0].reason,'Segunda autorización concurrente de la cuenta');assert.equal(row[0].revoked_at,null);
  // Concurrent revocations: exactly one effective revocation event.
  await actors.admin.client.query('begin');
  await actors.admin.client.query('select public.payment_sandbox_account_set($1,false,$2) value',[target,'Primera revocación concurrente de la cuenta']);
  const p2=second.query('select public.payment_sandbox_account_set($1,false,$2) value',[target,'Segunda revocación concurrente de la cuenta']);
  await waitBlocked('%payment_sandbox_account_set%');await actors.admin.client.query('commit');await p2;
  assert.equal((await admin.query("select count(*)::int n from private.payment_sandbox_account_events where user_id=$1 and action='revoked'",[target])).rows[0].n,1);
  await call('admin','select public.payment_sandbox_account_set($1,false,$2) value',[target,'Sin efecto: ya estaba revocada la cuenta']);   // idempotent no-op
  assert.equal((await admin.query("select count(*)::int n from private.payment_sandbox_account_events where user_id=$1",[target])).rows[0].n,3);
 });
 await check('S05 reconciliation vs checkout persistence: a pending observation never makes an attempt reopenable without its checkout (both orders, one charge)',async()=>{
  const attemptRow=async id=>(await admin.query('select state,flow_order::text fo,error_code,checkout_ciphertext is not null has_checkout from private.payment_attempts where id=$1',[id])).rows[0];
  const cust=actors.customerA.id,ambiguous=id=>wcall(w,'select public.payment_attempt_mark_ambiguous($1,$2) value',[id,'checkout_persist_failed']);
  // Sequence 1: ambiguous (checkout not stored) -> reconciliation sees Flow pending -> the same Flow identity completes persistence.
  const j=await newJob();await schedule(j);const p=await prepare('customerA',j);await wcall(w,'select public.payment_attempt_begin_create($1) value',[p.attempt_id]);await ambiguous(p.attempt_id);
  const f=++flow;assert.equal((await observe(w,p.attempt_id,{flow:f,commerce:p.commerce_order,status:1})).result,'pending');
  let row=await attemptRow(p.attempt_id);assert.equal(row.state,'reconciliation_required');assert.equal(row.fo,String(f));assert.equal(row.error_code,'checkout_not_persisted');assert.equal(row.has_checkout,false);
  await assert.rejects(()=>wcall(w,'select public.payment_attempt_checkout($1,$2) value',[p.attempt_id,cust]),{code:'PT409'});
  await assert.rejects(()=>prepare('customerA',j),{code:'PT409'});
  await assert.rejects(()=>wcall(w,'select public.payment_attempt_set_checkout($1,$2,$3,$4) value',[p.attempt_id,f+9000,Buffer.from('other'),'k']),{code:'PT409'});
  await wcall(w,'select public.payment_attempt_set_checkout($1,$2,$3,$4) value',[p.attempt_id,f,Buffer.from('ciphertext'),'test-key']);
  row=await attemptRow(p.attempt_id);assert.equal(row.state,'pending');assert.equal(row.has_checkout,true);
  assert.equal((await wcall(w,'select public.payment_attempt_checkout($1,$2) value',[p.attempt_id,cust])).key_id,'test-key');
  await assert.rejects(()=>wcall(w,'select public.payment_attempt_set_checkout($1,$2,$3,$4) value',[p.attempt_id,f,Buffer.from('again'),'k2']),{code:'PT409'});
  // Sequence 2: persistence first, then a pending observation keeps the stored checkout reopenable.
  const j2=await newJob();await schedule(j2);const p2=await prepare('customerA',j2);await checkout(p2,++flow);
  assert.equal((await observe(w,p2.attempt_id,{flow,commerce:p2.commerce_order,status:1})).result,'pending');
  row=await attemptRow(p2.attempt_id);assert.equal(row.state,'pending');assert.equal(row.has_checkout,true);
  // Sequence 3: observation while the create call is still in flight (creating) leaves it creating; set_checkout then completes it.
  const j3=await newJob();await schedule(j3);const p3=await prepare('customerA',j3);await wcall(w,'select public.payment_attempt_begin_create($1) value',[p3.attempt_id]);
  const f3=++flow;await observe(w,p3.attempt_id,{flow:f3,commerce:p3.commerce_order,status:1});assert.equal((await attemptRow(p3.attempt_id)).state,'creating');
  await wcall(w,'select public.payment_attempt_set_checkout($1,$2,$3,$4) value',[p3.attempt_id,f3,Buffer.from('ciphertext'),'test-key']);assert.equal((await attemptRow(p3.attempt_id)).state,'pending');
  // Sequence 4 (late persistence error): checkout committed -> pending observed -> mark_ambiguous arrives late -> same observation repeated. Never stuck, one attempt, no duplicated effect.
  const j4=await newJob();await schedule(j4);const p4=await prepare('customerA',j4);await checkout(p4,++flow);const f4=flow,ev4=async()=>(await admin.query('select count(*)::int n from private.payment_events where attempt_id=$1',[p4.attempt_id])).rows[0].n;
  assert.equal((await observe(w,p4.attempt_id,{key:'dup-seq4-'+p4.attempt_id,flow:f4,commerce:p4.commerce_order,status:1})).result,'pending');
  await ambiguous(p4.attempt_id);row=await attemptRow(p4.attempt_id);assert.equal(row.state,'pending');assert.equal(row.has_checkout,true);
  assert.equal((await observe(w,p4.attempt_id,{key:'dup-seq4-'+p4.attempt_id,flow:f4,commerce:p4.commerce_order,status:1})).result,'duplicate');
  assert.equal((await wcall(w,'select public.payment_attempt_checkout($1,$2) value',[p4.attempt_id,cust])).key_id,'test-key');assert.equal((await prepare('customerA',j4)).attempt_id,p4.attempt_id);assert.equal(await ev4(),1);
  // Defense in depth: an attempt already degraded WITH its checkout is recovered by a repeated (deduplicated) pending observation, without financial effects.
  await admin.query("update private.payment_attempts set state='reconciliation_required',error_code='checkout_persist_failed' where id=$1",[p4.attempt_id]);
  assert.equal((await observe(w,p4.attempt_id,{key:'dup-seq4-'+p4.attempt_id,flow:f4,commerce:p4.commerce_order,status:1})).result,'duplicate');
  row=await attemptRow(p4.attempt_id);assert.equal(row.state,'pending');assert.equal(row.error_code,null);assert.equal(await ev4(),1);
  assert.equal((await wcall(w,'select public.payment_attempt_checkout($1,$2) value',[p4.attempt_id,cust])).key_id,'test-key');
  assert.equal((await admin.query("select status,paid_attempt_id,review_reason from private.payment_orders where job_id=$1",[j4])).rows[0].status,'awaiting_payment');
  for(const id of [j,j2,j3,j4])assert.equal((await admin.query('select count(*)::int n from private.payment_attempts a join private.payment_orders o on o.id=a.order_id where o.job_id=$1',[id])).rows[0].n,1);
 });
 await check('S05 persistent rate limit: shared windows, denied hits still count, subjects independent, window rollover, cleanup, worker-only',async()=>{
  const hit=(scope,subject,max,win)=>wcall(w,'select public.payment_rate_limit_hit($1,$2,$3,$4) value',[scope,subject,max,win]);
  const subj='user:'+randomUUID();
  for(let i=1;i<=3;i++)assert.equal((await hit('checkout_user',subj,3,3600)).allowed,true);
  const denied=await hit('checkout_user',subj,3,3600);assert.equal(denied.allowed,false);assert.equal(denied.hits,4);assert.ok(denied.retry_after_seconds>=1&&denied.retry_after_seconds<=3600);
  assert.equal((await hit('checkout_user',subj,3,3600)).allowed,false);
  assert.equal((await wcall(w2,'select public.payment_rate_limit_hit($1,$2,$3,$4) value',['checkout_user',subj,3,3600])).allowed,false); // shared across connections/instances
  assert.equal((await hit('checkout_user','user:'+randomUUID(),3,3600)).allowed,true);
  assert.equal((await hit('callback_ip',subj,3,3600)).allowed,true); // scopes do not mix
  const quick='user:'+randomUUID();assert.equal((await hit('checkout_user',quick,1,1)).allowed,true);assert.equal((await hit('checkout_user',quick,1,1)).allowed,false);
  await new Promise(r=>setTimeout(r,2100));assert.equal((await hit('checkout_user',quick,1,1)).allowed,true); // new window
  for(const bad of [['bogus','a',1,60],['checkout_user','',1,60],['checkout_user','x'.repeat(129),1,60],['checkout_user','a',0,60],['checkout_user','a',10001,60],['checkout_user','a',1,0],['checkout_user','a',1,86401],['checkout_user',null,1,60]])
   await assert.rejects(()=>hit(...bad),{code:'22023'});
  await admin.query("insert into private.payment_rate_limits(scope,subject,window_start,hits)values('callback_ip','old',now()-interval '3 days',5)");
  assert.ok(await wcall(w,'select public.payment_rate_limit_cleanup() value')>=1);
  assert.equal((await admin.query("select count(*)::int n from private.payment_rate_limits where subject='old'")).rows[0].n,0);
  for(const label of ['customerA','moderator','admin',tech]){
   await assert.rejects(()=>call(label,"select public.payment_rate_limit_hit('checkout_user','x',1,60) value"),{code:'42501'});
   await assert.rejects(()=>call(label,'select public.payment_rate_limit_cleanup() value'),{code:'42501'});
  }
  await assert.rejects(()=>actors.customerA.client.query('select * from private.payment_rate_limits'),{code:'42501'});
  await assert.rejects(()=>actors.customerA.client.query("insert into private.payment_rate_limits(scope,subject,window_start)values('checkout_user','z',now())"),{code:'42501'});
 });
 await check('S05 inbox: duplicate notification bumps generation, newer generation is not lost, lease fencing, worker-only',async()=>{
  const hash='a'.repeat(64);const id=await wcall(w,'select public.payment_inbox_receive($1,$2,$3) value',[hash,Buffer.from('ct'),'k']);
  assert.equal(await wcall(w,'select public.payment_inbox_receive($1,$2,$3) value',[hash,Buffer.from('ct'),'k']),id);
  const claim=await wcall(w,'select public.payment_inbox_claim() value');assert.equal(claim.generation,2);assert.equal(claim.token_sha256,hash);assert.equal(Buffer.from(claim.token_ciphertext,'base64').toString(),'ct');assert.equal(await wcall(w2,'select public.payment_inbox_claim() value'),null);
  await wcall(w,'select public.payment_inbox_receive($1,$2,$3) value',[hash,Buffer.from('ct'),'k']);
  await assert.rejects(()=>wcall(w,'select public.payment_inbox_finish($1,$2,$3,$4) value',[id,randomUUID(),'done',2]),{code:'PT409'});
  await wcall(w,'select public.payment_inbox_finish($1,$2,$3,$4) value',[id,claim.lease_token,'done',2]);
  assert.equal((await admin.query('select state from private.payment_inbox where id=$1',[id])).rows[0].state,'pending');
  const again=await wcall(w,'select public.payment_inbox_claim() value');assert.equal(again.generation,3);
  await wcall(w,'select public.payment_inbox_finish($1,$2,$3,$4,$5) value',[id,again.lease_token,'quarantine',3,'unknown token']);
  assert.equal((await admin.query('select state from private.payment_inbox where id=$1',[id])).rows[0].state,'quarantined');
  await assert.rejects(()=>call('customerA','select public.payment_inbox_receive($1,$2,$3) value',[hash,Buffer.from('x'),'k']),{code:'42501'});
 });
 await check('S05 reconciliation: abandoned lease reclaimed with fencing; admin can only schedule a re-check, never impose paid',async()=>{
  const j=await newJob();const p=await prepare('customerA',j);await wcall(w,'select public.payment_attempt_begin_create($1) value',[p.attempt_id]);
  await admin.query("update private.payment_attempts set next_check_at=now()-interval '1 second' where id=$1",[p.attempt_id]);
  await isolate(p.attempt_id);
  const due=await wcall(w,'select public.payment_attempt_claim_due() value');assert.equal(due.attempt_id,p.attempt_id);
  assert.equal(await wcall(w2,'select public.payment_attempt_claim_due() value'),null);
  await admin.query("update private.payment_attempts set lease_until=now()-interval '1 second' where id=$1",[p.attempt_id]);
  const again=await wcall(w2,'select public.payment_attempt_claim_due() value');assert.equal(again.attempt_id,p.attempt_id);assert.notEqual(again.lease_token,due.lease_token);
  await assert.rejects(()=>wcall(w,'select public.payment_attempt_release($1,$2,60) value',[p.attempt_id,due.lease_token]),{code:'PT409'});
  await wcall(w2,'select public.payment_attempt_release($1,$2,60,$3) value',[p.attempt_id,again.lease_token,'provider_pending']);
  await call('admin','select public.payment_request_reconciliation($1) value',[p.attempt_id]);
  await assert.rejects(()=>call('moderator','select public.payment_request_reconciliation($1) value',[p.attempt_id]),{code:'42501'});
  assert.equal((await admin.query('select status from private.payment_orders where id=$1',[p.order_id])).rows[0].status,'awaiting_payment');
 });

 await check('S05 rejection/annulment before payment closes the attempt and allows a new one; after paid they stay stale',async()=>{
  for(const status of [3,4]){
   const j=await newJob();const p=await prepare('customerA',j);await checkout(p,++flow);
   assert.equal((await observe(w,p.attempt_id,{flow,commerce:p.commerce_order,status})).result,status===3?'failed':'cancelled');
   assert.equal((await admin.query('select state from private.payment_attempts where id=$1',[p.attempt_id])).rows[0].state,status===3?'failed':'cancelled');
   assert.equal(await state(j),'payment_pending');
   assert.equal(await outbox(j,status===3?'payment_rejected':'payment_cancelled'),2);
   const again=await prepare('customerA',j);assert.notEqual(again.attempt_id,p.attempt_id);
   assert.equal((await observe(w,p.attempt_id,{flow,commerce:p.commerce_order,status,key:'replay-final-'+status})).result,'stale');
  }
 });
 await check('S05 late verified payment from every terminal attempt state is recorded (event kept) and sent to review',async()=>{
  for(const terminal of ['failed','cancelled','quarantined']){
   const j=await newJob();const p=await prepare('customerA',j);await checkout(p,++flow);
   await admin.query('update private.payment_attempts set state=$2 where id=$1',[p.attempt_id,terminal]);
   assert.equal((await observe(w,p.attempt_id,{flow,commerce:p.commerce_order,key:'late-'+terminal+'-evt'})).result,'late_payment');
   const o=(await admin.query('select status,review_reason from private.payment_orders where id=$1',[p.order_id])).rows[0];assert.equal(o.status,'paid');assert.equal(o.review_reason,'late_payment');
   assert.equal((await admin.query("select count(*)::int n from private.payment_events where attempt_id=$1 and validation='late_payment'",[p.attempt_id])).rows[0].n,1);
   assert.equal(await state(j),'payment_review');
   await call('admin','select public.payment_enable_sandbox_job($1,24,$2) value',[j,'Prueba Sandbox aislada autorizada']);
   assert.equal(await call('admin','select private_probe($1) value'.replace('private_probe','public.job_payments'),[j]).then(v=>v.orders[0].review),true);
  }
 });
 await check('S05 payment after a participant suspension is recorded but keeps review and never enables execution',async()=>{
  const j=await newJob();await schedule(j);const p=await prepare('customerA',j);await checkout(p,++flow);
  await call('admin','select public.payment_enable_sandbox_job($1,24,$2) value',[j,'Prueba Sandbox aislada autorizada']);
  await admin.query("update public.profiles set account_status='suspended' where id=$1",[actors.customerA.id]);
  try{
   assert.equal((await observe(w,p.attempt_id,{flow,commerce:p.commerce_order})).result,'late_payment');
  }finally{await admin.query("update public.profiles set account_status='active' where id=$1",[actors.customerA.id]);}
  assert.equal((await admin.query('select review_reason from private.payment_orders where id=$1',[p.order_id])).rows[0].review_reason,'participant_suspended');
  assert.equal((await admin.query('select private.job_execution_allowed($1) allowed',[j])).rows[0].allowed,false);
  await assert.rejects(()=>rpc(tech,j,'prepare'),{code:'42501'});
 });
 await check('S05 observations without a valid Flow identity (null, zero, negative) have no financial effect',async()=>{
  const j=await newJob();const p=await prepare('customerA',j);await wcall(w,'select public.payment_attempt_begin_create($1) value',[p.attempt_id]);
  for(const [i,bad] of [null,0,-5].entries()){
   const r=await wcall(w,'select public.payment_apply_observation($1,$2,$3,$4,2,$5,$6,null,now()) value',[p.attempt_id,'incomplete-evt-'+i,bad,p.commerce_order,T_of(p),'CLP']);
   assert.equal(r.validation,'incomplete');
  }
  assert.equal((await admin.query('select status from private.payment_orders where id=$1',[p.order_id])).rows[0].status,'awaiting_payment');
  assert.equal((await admin.query('select state,flow_order from private.payment_attempts where id=$1',[p.attempt_id])).rows[0].state,'creating');
  assert.equal(await state(j),'payment_pending');
 });
 await check('S05 Flow cost can be completed after the first paid without reapplying payment or duplicating notices',async()=>{
  const j=await newJob();const p=await prepare('customerA',j);await checkout(p,++flow);
  assert.equal((await observe(w,p.attempt_id,{flow,commerce:p.commerce_order,key:'paid-nocost-1'})).result,'applied');
  assert.equal((await admin.query('select flow_cost_clp from private.payment_orders where id=$1',[p.order_id])).rows[0].flow_cost_clp,null);
  assert.equal((await call('admin','select public.job_payments($1) value',[j])).orders[0].margin_status,'pending_reconciliation');
  await admin.query("update private.payment_attempts set next_check_at=now()-interval '1 second' where id=$1",[p.attempt_id]);
  await isolate(p.attempt_id);
  const due=await wcall(w,'select public.payment_attempt_claim_due() value');assert.equal(due.attempt_id,p.attempt_id);assert.equal(due.state,'paid');
  await wcall(w,'select public.payment_attempt_release($1,$2,30) value',[p.attempt_id,due.lease_token]);
  assert.equal((await observe(w,p.attempt_id,{flow,commerce:p.commerce_order,key:'paid-cost-2',fee:250})).result,'cost_updated');
  assert.equal(Number((await admin.query('select flow_cost_clp from private.payment_orders where id=$1',[p.order_id])).rows[0].flow_cost_clp),250);
  assert.equal(await outbox(j,'payment_confirmed'),2);assert.equal(await state(j),'paid');
  assert.equal((await call('admin','select public.job_payments($1) value',[j])).orders[0].margin_status,'confirmed');
  await admin.query("update private.payment_attempts set next_check_at=now()-interval '1 second' where id=$1",[p.attempt_id]);
  const rest=await wcall(w,'select public.payment_attempt_claim_due() value');assert.notEqual(rest?.attempt_id,p.attempt_id);
 });
 await check('S05 simulated settlement is withheld by later incidents or financial review',async()=>{
  assert.ok((await call('customerA','select public.job_payments($1) value',[job])).orders.every(o=>o.simulated_settlement_clp>0));
  await rpc('customerA',job,'open_incident',{kind:'quality',description:'Reclamo sintético posterior al cierre del trabajo'});
  assert.ok((await call('customerA','select public.job_payments($1) value',[job])).orders.every(o=>o.simulated_settlement_clp===null));
  const inc=(await detail('customerA',job)).incidents[0];await rpc('admin',job,'resolve_incident',{incidentId:inc.id,message:'Reclamo resuelto sin ajuste alguno'});
  assert.ok((await call('customerA','select public.job_payments($1) value',[job])).orders.every(o=>o.simulated_settlement_clp>0));
  await admin.query("update private.payment_orders set review_reason='manual_review' where id=$1",[p1.order_id]);
  assert.ok((await call('customerA','select public.job_payments($1) value',[job])).orders.every(o=>o.simulated_settlement_clp===null));
 });
 await check('S05 extra proposals are idempotent (replay, concurrency, changed payload)',async()=>{
  const j=await newJob();await schedule(j);const p=await prepare('customerA',j);await checkout(p,++flow);await observe(w,p.attempt_id,{flow,commerce:p.commerce_order});
  await call('admin','select public.payment_enable_sandbox_job($1,24,$2) value',[j,'Prueba Sandbox aislada autorizada']);await rpc(tech,j,'prepare');
  const op=randomUUID(),first=await call(tech,'select public.job_extra_propose($1,$2,$3,$4) value',[j,op,'Cambio de llave de paso',12000]);
  assert.deepEqual(await call(tech,'select public.job_extra_propose($1,$2,$3,$4) value',[j,op,'  Cambio de llave de paso ',12000]),first);
  await assert.rejects(()=>call(tech,'select public.job_extra_propose($1,$2,$3,$4) value',[j,op,'Cambio de llave de paso',13000]),{code:'PT409'});
  await assert.rejects(()=>call(tech,'select public.job_extra_propose($1,$2,$3,$4) value',[j,op,'Otro concepto distinto aquí',12000]),{code:'PT409'});
  assert.equal((await admin.query('select count(*)::int n from private.job_extra_charges where job_id=$1',[j])).rows[0].n,1);
  assert.equal(await outbox(j,'extra_charge_proposed'),2);
  const sid=(await admin.query('select id from auth.sessions where user_id=$1',[actors[tech].id])).rows[0].id,second=server.getPgClient('postgres','127.0.0.1');await second.connect();clients.push(second);
  await second.query('set role authenticated');await second.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:actors[tech].id,session_id:sid,role:'authenticated'})]);
  const op2=randomUUID(),run=c=>c.query('select public.job_extra_propose($1,$2,$3,$4) value',[j,op2,'Reparación de sello adicional',9000]).then(r=>r.rows[0].value);
  const [a,b]=await Promise.all([run(actors[tech].client),run(second)]);assert.equal(a.id,b.id);
  assert.equal((await admin.query('select count(*)::int n from private.job_extra_charges where job_id=$1',[j])).rows[0].n,2);assert.equal(await outbox(j,'extra_charge_proposed'),4);
  await assert.rejects(()=>call(tech,'select public.job_extra_propose($1,null,$2,$3) value',[j,'Operación sin identificador',5000]),{code:'22023'});
 });
 await check('S05 begin_create revalidates the obligation: paid by a late first attempt, review, cancellation, suspension',async()=>{
  const j=await newJob();await schedule(j);const a1=await prepare('customerA',j);await wcall(w,'select public.payment_attempt_begin_create($1) value',[a1.attempt_id]);
  await admin.query("update private.payment_attempts set state='failed' where id=$1",[a1.attempt_id]);
  const a2=await prepare('customerA',j);assert.notEqual(a2.attempt_id,a1.attempt_id);
  await observe(w,a1.attempt_id,{flow:++flow,commerce:a1.commerce_order,key:'late-first-evt'});
  assert.equal((await admin.query('select state from private.payment_attempts where id=$1',[a2.attempt_id])).rows[0].state,'cancelled');
  await assert.rejects(()=>wcall(w,'select public.payment_attempt_begin_create($1) value',[a2.attempt_id]),{code:'PT409'});
  for(const [name,breakIt,fixIt] of [
   ['review',id=>admin.query("update private.payment_orders set review_reason='manual_review' where job_id=$1",[id]),null],
   ['cancelled',id=>admin.query("update public.jobs set status='cancelled',revision=revision+1 where id=$1",[id]),null],
   ['suspended',()=>admin.query("update public.profiles set account_status='suspended' where id=$1",[actors.customerA.id]),()=>admin.query("update public.profiles set account_status='active' where id=$1",[actors.customerA.id])]]){
   const k=await newJob();const p=await prepare('customerA',k);await breakIt(k);
   try{await assert.rejects(()=>wcall(w,'select public.payment_attempt_begin_create($1) value',[p.attempt_id]),{code:'PT409'});}finally{if(fixIt)await fixIt();}
   assert.equal((await admin.query('select state from private.payment_attempts where id=$1',[p.attempt_id])).rows[0].state,'prepared',name);
  }
 });
 await check('S05 lost prepare response: the prepared attempt is recovered by the same customer from a new key/session, never duplicated',async()=>{
  const j=await newJob();const first=await prepare('customerA',j);
  const sid=(await admin.query('select id from auth.sessions where user_id=$1',[actors.customerA.id])).rows[0].id,tab=server.getPgClient('postgres','127.0.0.1');await tab.connect();clients.push(tab);
  await tab.query('set role authenticated');await tab.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:actors.customerA.id,session_id:sid,role:'authenticated'})]);
  const again=(await tab.query('select public.payment_prepare($1,null,$2,true,$3) value',[j,await current(),randomUUID()])).rows[0].value;
  assert.equal(again.attempt_id,first.attempt_id);assert.equal(again.commerce_order,first.commerce_order);
  assert.equal((await call('customerA','select public.job_payments($1) value',[j])).orders[0].latest_attempt_id,first.attempt_id);
  assert.equal((await call(tech,'select public.job_payments($1) value',[j])).orders[0].latest_attempt_id,null);
  assert.equal((await admin.query('select count(*)::int n from private.payment_attempts where order_id=$1',[first.order_id])).rows[0].n,1);
  await assert.rejects(()=>prepare('customerB',j),{code:'42501'});
  await wcall(w,'select public.payment_attempt_begin_create($1) value',[first.attempt_id]);
  await assert.rejects(()=>prepare('customerA',j),{code:'PT409'});
 });
 await check('S05 annulment of a second open attempt closes it after the order was paid by the first (payment untouched, no notice)',async()=>{
  const j=await newJob();const a1=await prepare('customerA',j);await wcall(w,'select public.payment_attempt_begin_create($1) value',[a1.attempt_id]);
  await admin.query("update private.payment_attempts set state='failed' where id=$1",[a1.attempt_id]);
  const a2=await prepare('customerA',j);await checkout(a2,++flow);
  assert.equal((await observe(w,a1.attempt_id,{flow:++flow,commerce:a1.commerce_order,key:'two-attempts-late'})).result,'late_payment');
  const before=await outbox(j,'payment_cancelled');
  assert.equal((await observe(w,a2.attempt_id,{flow:flow-1,commerce:a2.commerce_order,status:4,key:'two-attempts-cancel'})).result,'cancelled');
  assert.equal((await admin.query('select state from private.payment_attempts where id=$1',[a2.attempt_id])).rows[0].state,'cancelled');
  assert.equal((await admin.query('select status,paid_attempt_id from private.payment_orders where id=$1',[a1.order_id])).rows[0].paid_attempt_id,a1.attempt_id);
  assert.equal(await outbox(j,'payment_cancelled'),before);assert.equal(await state(j),'payment_review');
 });
 await check('S05 pending Flow cost: exhausted checks stay visible; only superadmin reschedules the cost re-check; payment untouched',async()=>{
  const j=await newJob();const p=await prepare('customerA',j);await checkout(p,++flow);await observe(w,p.attempt_id,{flow,commerce:p.commerce_order,key:'cost-exhaust-paid'});
  await admin.query("update private.payment_attempts set check_count=10,next_check_at=now()-interval '1 second',lease_until=null where id=$1",[p.attempt_id]);
  const seen=await wcall(w,'select public.payment_attempt_claim_due() value');assert.notEqual(seen?.attempt_id,p.attempt_id);
  const overview=await call('moderator','select public.payment_admin_overview() value');const row=overview.pending.find(r=>r.attempt_id===p.attempt_id);
  assert.ok(row);assert.equal(row.cost_pending,true);assert.equal(row.exhausted,true);
  await assert.rejects(()=>call('moderator','select public.payment_request_reconciliation($1) value',[p.attempt_id]),{code:'42501'});
  await call('admin','select public.payment_request_reconciliation($1) value',[p.attempt_id]);
  await isolate(p.attempt_id);
  const due=await wcall(w,'select public.payment_attempt_claim_due() value');assert.equal(due.attempt_id,p.attempt_id);assert.equal(due.check_count,1);
  assert.equal((await observe(w,p.attempt_id,{flow,commerce:p.commerce_order,key:'cost-exhaust-cost',fee:400})).result,'cost_updated');
  assert.equal((await admin.query('select status from private.payment_orders where id=$1',[p.order_id])).rows[0].status,'paid');
  assert.equal(await outbox(j,'payment_confirmed'),2);
  await assert.rejects(()=>call('admin','select public.payment_request_reconciliation($1) value',[p.attempt_id]),{code:'PT409'});
  assert.equal((await call('admin','select public.payment_admin_overview() value')).pending.some(r=>r.attempt_id===p.attempt_id),false);
 });
 await check('S05 closing needs an existing initial obligation paid and unreviewed; pilots without orders still close',async()=>{
  const pilot=id=>admin.query("update private.job_execution_policies set mode='authorized_pilot',approved_by=$2,reason='Synthetic isolated test only, no commercial service',authorized_at=now(),expires_at=now()+interval '2 hours' where job_id=$1",[id,actors.admin.id]);
  const run=async id=>{await schedule(id);await pilot(id);await rpc(tech,id,'prepare');await rpc(tech,id,'start');await rpc(tech,id,'report_completion',{message:'Trabajo piloto informado como terminado'});};
  const plain=await newJob();await run(plain);assert.equal((await rpc('customerA',plain,'confirm_completion')).status,'completed');
  const j=await newJob();await run(j);const p=await prepare('customerA',j);
  await assert.rejects(()=>rpc('customerA',j,'confirm_completion'),{code:'PT409'});
  await checkout(p,++flow);
  await assert.rejects(()=>rpc('customerA',j,'confirm_completion'),{code:'PT409'});
  await observe(w,p.attempt_id,{flow,commerce:p.commerce_order,key:'pilot-close-paid'});
  assert.equal((await rpc('customerA',j,'confirm_completion')).status,'completed');
  const r=await newJob();await run(r);const pr=await prepare('customerA',r);await checkout(pr,++flow);await observe(w,pr.attempt_id,{flow,commerce:pr.commerce_order,key:'pilot-review-paid'});
  await admin.query("update private.payment_orders set review_reason='manual_review' where id=$1",[pr.order_id]);
  await assert.rejects(()=>rpc('customerA',r,'confirm_completion'),{code:'PT409'});
 });
 await check('S05 consent covers the exact breakdown: with two tabs and a fee change, a stale version can neither pay nor reopen the order (frozen version is exposed)',async()=>{
  const j=await newJob(),vA=await current();                       // tab A displays the breakdown under vA
  await call('admin','select public.payment_policy_set($1,2000,$2) value',[vA,'Cambio de prueba para dos pestañas y consentimiento']);
  const vB=await current();assert.equal(vB,vA+1);
  const b=await prepare('customerA',j,null,vB);                      // tab B displays the new breakdown and creates the order under vB
  assert.equal(b.policy_version,vB);
  await assert.rejects(()=>prepare('customerA',j,null,vA),{code:'PT409'});   // tab A: stale consent cannot reuse the order
  await checkout(b,++flow);
  await assert.rejects(()=>prepare('customerA',j,null,vA),{code:'PT409'});   // ...nor reopen its live checkout
  const reopened=await prepare('customerA',j,null,vB);assert.equal(reopened.attempt_id,b.attempt_id);assert.equal(reopened.total_clp,b.total_clp);
  const view=await call('customerA','select public.job_payments($1) value',[j]);assert.equal(view.orders[0].policy_version,vB);assert.equal(view.orders[0].total_clp,b.total_clp);
  assert.equal((await call(tech,'select public.job_payments($1) value',[j])).orders[0].total_clp,null);
  const o=(await admin.query('select fee_basis_points,professional_amount_clp q,platform_fee_clp f,total_clp t from private.payment_orders where id=$1',[b.order_id])).rows[0];
  assert.equal(o.fee_basis_points,2000);assert.equal(Number(o.t),Number(o.q)+Number(o.f));
  assert.equal((await admin.query('select count(*)::int n from private.payment_attempts where order_id=$1',[b.order_id])).rows[0].n,1);
  await call('admin','select public.payment_policy_set($1,1000,$2) value',[vB,'Restauración del porcentaje tras la prueba de consentimiento']);
 });
 await check('S05 admin settings: policy history (author, reason, date) is visible to moderator read-only; only superadmin edits or reschedules',async()=>{
  const v=await current();
  await call('admin','select public.payment_policy_set($1,700,$2) value',[v,'Ajuste de prueba para revisar el historial administrativo']);
  const ov=await call('moderator','select public.payment_admin_overview() value');
  assert.equal(ov.policy.version,v+1);assert.equal(ov.policy.fee_basis_points,700);
  assert.equal(ov.history[0].version,v+1);assert.equal(ov.history[0].reason,'Ajuste de prueba para revisar el historial administrativo');assert.ok(ov.history[0].author_name);assert.ok(ov.history[0].created_at);
  assert.equal(ov.history[ov.history.length-1].version,ov.history.length===10?v+1-9:1);assert.ok(ov.history.length<=10);
  assert.equal(ov.history.find(h=>h.version===1).author_name,null);
  await assert.rejects(()=>call('moderator','select public.payment_policy_set($1,100,$2) value',[v+1,'Moderador sin permiso para editar']),{code:'42501'});
  await assert.rejects(()=>call('admin','select public.payment_policy_set($1,100,$2) value',[v,'Versión obsoleta de otra pestaña']),{code:'PT409'});
  await assert.rejects(()=>call('customerA','select public.payment_admin_overview() value'),{code:'42501'});
  await assert.rejects(()=>call('moderator','select public.payment_request_reconciliation($1) value',[randomUUID()]),{code:'42501'});
  await call('admin','select public.payment_policy_set($1,1000,$2) value',[v+1,'Restauración del porcentaje tras la prueba administrativa']);
 });
 await check('S05 retention: only resolved token material is purged; pending checkouts stay recoverable; identities, hashes and events are kept; replay restores material',async()=>{
  const purge=(c,d=0)=>wcall(c,'select public.payment_purge_sensitive($1) value',[d]);
  const rcv=(hash,ct='ct')=>wcall(w,'select public.payment_inbox_receive($1,$2,$3) value',[hash,Buffer.from(ct),'k']);
  // Attempts: one paid (final), one pending (recoverable), one failed.
  const jp=await newJob();await schedule(jp);const paid=await prepare('customerA',jp);await checkout(paid,++flow);assert.equal((await observe(w,paid.attempt_id,{flow,commerce:paid.commerce_order})).result,'applied');
  const jq=await newJob();await schedule(jq);const open=await prepare('customerA',jq);await checkout(open,++flow);
  const jf=await newJob();await schedule(jf);const failed=await prepare('customerA',jf);await checkout(failed,++flow);assert.equal((await observe(w,failed.attempt_id,{flow,commerce:failed.commerce_order,status:3})).result,'failed');
  const snap=async id=>(await admin.query('select state,flow_order::text fo,commerce_order,idempotency_key,checkout_ciphertext is not null has_ct,checkout_key_id is not null has_key from private.payment_attempts where id=$1',[id])).rows[0];
  const eventsBefore=(await admin.query('select count(*)::int n from private.payment_events')).rows[0].n;
  const before={paid:await snap(paid.attempt_id),open:await snap(open.attempt_id),failed:await snap(failed.attempt_id)};
  assert.ok(before.paid.has_ct&&before.open.has_ct&&before.failed.has_ct);
  // Inbox: A done and quiet, B pending, C quarantined, D done but a newer generation is unprocessed.
  const hA='b'.repeat(64),hB='c'.repeat(64),hC='d'.repeat(64),hD='e'.repeat(64);
  for(const h of[hA,hB,hC,hD])await rcv(h);
  await admin.query("update private.payment_inbox set state='done',processed_generation=generation,next_attempt_at=now() where token_sha256=$1",[hA]);
  await admin.query("update private.payment_inbox set state='quarantined',quarantine_reason='test' where token_sha256=$1",[hC]);
  await admin.query("update private.payment_inbox set state='done',generation=2,processed_generation=1 where token_sha256=$1",[hD]);
  // A long retention purges nothing from fresh rows.
  assert.deepEqual(await purge(w,30),{attempts:0,inbox:0,retention_days:30});
  const res=await purge(w,0);assert.ok(res.attempts>=2&&res.inbox>=1);
  const after={paid:await snap(paid.attempt_id),open:await snap(open.attempt_id),failed:await snap(failed.attempt_id)};
  for(const k of['paid','failed']){assert.equal(after[k].has_ct,false);assert.equal(after[k].has_key,false);assert.deepEqual({...after[k],has_ct:null,has_key:null},{...before[k],has_ct:null,has_key:null});}
  assert.deepEqual(after.open,before.open);                                                   // pending: untouched and still reopenable
  assert.equal((await wcall(w,'select public.payment_attempt_checkout($1,$2) value',[open.attempt_id,actors.customerA.id])).key_id,'test-key');
  assert.equal((await admin.query('select count(*)::int n from private.payment_events')).rows[0].n,eventsBefore);
  assert.equal(await state(jp),'paid');
  const inbox=async h=>(await admin.query('select state,generation,token_ciphertext is not null has_ct,key_id from private.payment_inbox where token_sha256=$1',[h])).rows[0];
  assert.equal((await inbox(hA)).has_ct,false);assert.equal((await inbox(hA)).key_id,null);
  for(const h of[hB,hC,hD])assert.equal((await inbox(h)).has_ct,true);                       // unprocessed/quarantined/newer generation keep their material
  assert.equal((await purge(w,0)).inbox,0);                                                   // idempotent
  // Replay of a purged token: the new request restores material (the worker can decrypt it again); hash and identity are unchanged.
  await rcv(hA,'fresh-ct');const re=await inbox(hA);assert.equal(re.state,'pending');assert.equal(re.generation,2);assert.equal(re.has_ct,true);assert.equal(re.key_id,'k');
  // Privileges and validation.
  for(const label of['customerA','moderator','admin'])await assert.rejects(()=>call(label,'select public.payment_purge_sensitive(30) value'),{code:'42501'});
  for(const bad of[-1,4000,null])await assert.rejects(()=>wcall(w,'select public.payment_purge_sensitive($1) value',[bad]),{code:'22023'});
 });
}
