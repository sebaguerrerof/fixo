// Persistent, concurrency=1 worker; deploy on a dedicated host, never Vercel.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createClient } from '@supabase/supabase-js';
import { inspectDocument } from './lib/inspect-document.mjs';
const env={...process.env};
if(env.FIXO_INSPECTION_LOAD_LOCAL==='true')for(const line of (await readFile('.env.local','utf8')).split(/\r?\n/)){
 const match=line.match(/^([A-Z_][A-Z_0-9]*)\s*=\s*(.*)$/);
 if(match&&!env[match[1]])env[match[1]]=match[2].replace(/^(['"])(.*)\1$/,'$2');
}
assert.match(env.FIXO_INSPECTION_PROJECT??'',/^[a-z0-9]{20}$/);
assert.equal(new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname,env.FIXO_INSPECTION_PROJECT+'.supabase.co');
const client=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
let stopping=false;process.on('SIGINT',()=>{stopping=true;});process.on('SIGTERM',()=>{stopping=true;});
let failures=0;
do{
 try{
  const claim=await client.rpc('claim_professional_inspection');if(claim.error)throw new Error('claim_failed');
  if(!claim.data){if(process.argv.includes('--once'))break;await delay(15000);continue;}
  const job=claim.data;let result={result:'error'};
  try{
   // Cache-busting avoids scanning stale bytes on repeated Storage downloads.
   const download=await client.storage.from('technician-documents').download(job.storage_path,{cacheNonce:randomUUID()},{cache:'no-store'});
   if(download.error)throw new Error('download_failed');
   result=await inspectDocument(Buffer.from(await download.data.arrayBuffer()),download.data.type);
  }catch{/* Fail closed: queue retries; no keys, paths, bytes or provider errors in logs. */}
  const finished=await client.rpc('finish_professional_inspection',{document_id:job.document_id,lease_token:job.lease_token,result});
  if(finished.error)throw new Error('finish_failed');
  console.log(JSON.stringify({event:'inspection_finished',result:result.result,attempt:job.attempt}));failures=0;
 }catch{failures++;console.error(JSON.stringify({event:'worker_unavailable',retry:failures}));if(process.argv.includes('--once')){process.exitCode=1;break;}await delay(Math.min(60000,5000*failures));}
}while(!stopping&&!process.argv.includes('--once'));
