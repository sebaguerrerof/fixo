import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { captureJobNotification, processJobNotification } from './lib/job-notification.mjs';
const ref='rjzyqdhotcshvbdcrgon',run=process.env.FIXO_SPRINT04_RUN;assert.equal(process.env.FIXO_SPRINT04_AUTHORIZED,ref);assert.match(run??'',/^[0-9a-f-]{36}$/);
const dir='.audit-backups/sprint04-native/'+run,m=JSON.parse(await readFile(dir+'/manifest.json','utf8'));assert.equal(m.project,ref);
const env={};for(const line of(await readFile('.env.local','utf8')).split(/\r?\n/)){const x=line.match(/^([A-Z_][A-Z_0-9]*)\s*=\s*(.*)$/);if(x)env[x[1]]=x[2].replace(/^(['"])(.*)\1$/,'$2');}
assert.equal(new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname,ref+'.supabase.co');
const fresh=()=>createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}}),a=fresh(),b=fresh(),allowedRecipients=new Set(m.actors.map(a=>a.id));
const claims=await Promise.all([a.rpc('claim_job_notification'),b.rpc('claim_job_notification')]);for(const r of claims)assert.equal(r.error,null);const items=claims.map(r=>r.data);assert.notEqual(items[0].id,items[1].id);for(const i of items)assert.ok(allowedRecipients.has(i.recipient_id));
assert.equal((await a.rpc('finish_job_notification',{notification_id:items[0].id,lease_token:randomUUID(),outcome:'captured'})).error?.code,'PT409');
assert.equal((await a.rpc('finish_job_notification',{notification_id:items[0].id,lease_token:items[0].lease_token,outcome:'delivered'})).error?.code,'22023');
for(const i of items){const options={directory:dir+'/notifications',allowedRecipients},reference=await captureJobNotification(i,options);assert.equal(await captureJobNotification(i,options),reference);const args={notification_id:i.id,lease_token:i.lease_token,outcome:'captured',provider_reference:reference};assert.equal((await a.rpc('finish_job_notification',args)).error,null);assert.equal((await a.rpc('finish_job_notification',args)).error,null);}
let claimed,finished;const wrapper={rpc:async(name,args)=>{const r=await a.rpc(name,args);if(name==='claim_job_notification')claimed=r.data;else finished=args;return r;}};
await processJobNotification(wrapper,{directory:dir+'/notifications',allowedRecipients:new Set()});assert.ok(allowedRecipients.has(claimed.recipient_id));assert.equal(finished.outcome,'retry');
m.workerChecks=['two concurrent service workers claim distinct notices','lease fencing and rejection of unverified delivery; capture replay is idempotent','unavailable adapter records retry without external mail'];await writeFile(dir+'/manifest.json',JSON.stringify(m,null,2));console.log(JSON.stringify({status:'PASS integración',checks:3,externalMail:false}));
