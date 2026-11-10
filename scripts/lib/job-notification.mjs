import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const events=new Set(['quote_accepted','job_awarded','propose_schedule','accept_schedule','reject_schedule','prepare','start','progress','report_completion','confirm_completion','request_cancellation','resolve_cancellation','open_incident','reply_incident','request_information','add_observation','resolve_incident','incident_evidence_added','execution_policy_changed']);
/** Captures a redacted transactional notice. Never sends mail or records destination/notes/address. */
export async function captureJobNotification(item,{directory,allowedRecipients}){
 if(!directory||!allowedRecipients?.has(item.recipient_id)||!uuid.test(item.id)||!uuid.test(item.job_id)||!uuid.test(item.recipient_id)||!events.has(item.template))throw new Error('capture_not_authorized');
 const record={id:item.id,jobId:item.job_id,recipientId:item.recipient_id,template:item.template,subject:'Hay una actualización en tu trabajo de Fixo',body:'Inicia sesión en Fixo para consultar el historial privado del trabajo.',channel:'email',delivery:'captured_only'};
 const content=JSON.stringify(record,null,2),path=resolve(directory,item.id+'.json');await mkdir(directory,{recursive:true});
 try{await writeFile(path,content,{flag:'wx',mode:0o600});}catch(e){if(e.code!=='EEXIST'||await readFile(path,'utf8')!==content)throw new Error('capture_conflict');}
 return 'capture:'+createHash('sha256').update(content).digest('hex');
}
export async function processJobNotification(client,options){
 const claim=await client.rpc('claim_job_notification');if(claim.error)throw new Error('claim_failed');if(!claim.data)return false;
 const item=claim.data;let outcome='retry',reference=null;
 try{reference=await captureJobNotification(item,options);outcome='captured';}catch{/* Only a fixed failure code is recorded by the DB. No provider exception/PII logging. */}
 const finish=await client.rpc('finish_job_notification',{notification_id:item.id,lease_token:item.lease_token,outcome,provider_reference:reference});if(finish.error)throw new Error('finish_failed');return true;
}
