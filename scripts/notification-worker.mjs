// Capture adapter only. Deploying a real email provider is a separately authorized operation.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { createClient } from '@supabase/supabase-js';
import { processJobNotification } from './lib/job-notification.mjs';
const env={...process.env};
if(env.FIXO_NOTIFICATION_LOAD_LOCAL==='true')for(const line of(await readFile('.env.local','utf8')).split(/\r?\n/)){const m=line.match(/^([A-Z_][A-Z_0-9]*)\s*=\s*(.*)$/);if(m&&!env[m[1]])env[m[1]]=m[2].replace(/^(['"])(.*)\1$/,'$2');}
assert.equal(env.FIXO_NOTIFICATION_ADAPTER,'capture');assert.match(env.FIXO_NOTIFICATION_PROJECT??'',/^[a-z0-9]{20}$/);
assert.equal(new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname,env.FIXO_NOTIFICATION_PROJECT+'.supabase.co');
const allowedRecipients=new Set((env.FIXO_NOTIFICATION_SYNTHETIC_RECIPIENTS??'').split(',').filter(Boolean));assert.ok(allowedRecipients.size>0);assert.ok(env.FIXO_NOTIFICATION_CAPTURE_DIR);
const client=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
let stopping=false;process.on('SIGINT',()=>{stopping=true;});process.on('SIGTERM',()=>{stopping=true;});let failures=0;
do{try{const worked=await processJobNotification(client,{directory:env.FIXO_NOTIFICATION_CAPTURE_DIR,allowedRecipients});failures=0;if(worked)console.log(JSON.stringify({event:'notification_processed',adapter:'capture'}));if(process.argv.includes('--once'))break;if(!worked)await delay(15000);}catch{failures++;console.error(JSON.stringify({event:'notification_worker_unavailable',retry:failures}));if(process.argv.includes('--once')){process.exitCode=1;break;}await delay(Math.min(60000,5000*failures));}}while(!stopping);
