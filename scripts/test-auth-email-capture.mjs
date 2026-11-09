// Local SMTP bridge test. Hosted Auth SMTP delivery is deliberately NOT claimed.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { createClient } from '@supabase/supabase-js';
const ref='rjzyqdhotcshvbdcrgon',run=process.env.FIXO_SPRINT03_RUN;assert.equal(process.env.FIXO_SPRINT03_AUTHORIZED,ref);assert.match(run??'',/^[0-9a-f-]{36}$/);
const dir='.audit-backups/sprint03-native/'+run,manifest=JSON.parse(await readFile(dir+'/manifest.json','utf8'));assert.equal(manifest.project,ref);
const env={};for(const line of(await readFile('.env.local','utf8')).split(/\r?\n/)){const m=line.match(/^([A-Z_][A-Z_0-9]*)\s*=\s*(.*)$/);if(m)env[m[1]]=m[2].replace(/^(['"])(.*)\1$/,'$2');}
assert.equal(new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname,ref+'.supabase.co');
const config={auth:{persistSession:false,autoRefreshToken:false}},admin=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,config),operator=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,config);
const account=manifest.actors.find(a=>a.label==='administrator');assert.equal((await operator.auth.signInWithPassword({email:account.email,password:account.password})).error,null);
const captureDir=dir+'/mailpit-'+randomUUID();await mkdir(captureDir,{recursive:true});
const childEnv=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('MP_')));
const child=spawn('.audit-backups/tooling/mailpit-1.33.1/bin/mailpit.exe',['--database',captureDir+'/capture.sqlite','--listen','127.0.0.1:58025','--smtp','127.0.0.1:51025','--allowed-hosts','127.0.0.1,localhost','--smtp-allowed-recipients','@local\\.invalid$','--smtp-disable-rdns','--disable-version-check','--block-remote-css-and-fonts','--max','30','--max-message-size','1','--quiet'],{env:childEnv,windowsHide:true,stdio:'ignore'});
const checks=[],links=[];const persist=()=>writeFile(dir+'/manifest.json',JSON.stringify(manifest,null,2));
async function smtp(to,html,subject){assert.ok(to.endsWith('@local.invalid'));const socket=createConnection({host:'127.0.0.1',port:51025});socket.setTimeout(10000,()=>socket.destroy(new Error('SMTP timeout')));let buffer='',pending;
 socket.on('data',chunk=>{buffer+=chunk.toString();const lines=buffer.split('\r\n');buffer=lines.pop();for(const line of lines)if(/^\d{3} /.test(line)&&pending){const fn=pending;pending=null;fn(line);}});
 const exchange=(command,code)=>new Promise((resolve,reject)=>{const failed=e=>reject(e);socket.once('error',failed);pending=line=>{socket.removeListener('error',failed);try{assert.equal(Number(line.slice(0,3)),code);resolve();}catch(e){reject(e);}};if(command)socket.write(command+'\r\n');});
 try{await exchange(null,220);await exchange('EHLO fixture.local',250);await exchange('MAIL FROM:<capture@local.invalid>',250);await exchange('RCPT TO:<'+to+'>',250);await exchange('DATA',354);
 await exchange('From: Fixo local <capture@local.invalid>\r\nTo: <'+to+'>\r\nSubject: '+subject+'\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n'+Buffer.from(html).toString('base64')+'\r\n.',250);await exchange('QUIT',221);
 }finally{socket.destroy();}}
async function deliver(kind,label,email,password,template,linkType=kind){
 const metadata={first_name:'Synthetic',last_name:label,phone:'+56912345678',terms_accepted:true,account_type:'customer',fixo_test_run:run};
 const generated=await admin.auth.admin.generateLink({type:kind,email,...(password?{password}:{}),options:{data:metadata,redirectTo:'http://127.0.0.1:3017/auth/callback'}});assert.equal(generated.error,null);
 if(!manifest.actors.some(a=>a.id===generated.data.user.id)){manifest.actors.push({label,id:generated.data.user.id,email,password:password??null});await persist();}
 const token=generated.data.properties.hashed_token;assert.ok(token);
 const html=(await readFile('supabase/templates/'+template+'.html','utf8')).replaceAll('{{ .SiteURL }}','http://127.0.0.1:3017').replaceAll('{{ .TokenHash }}',token);
 assert.ok(!html.includes('{{'));await smtp(email,html,'Synthetic '+label);
 const messages=await(await fetch('http://127.0.0.1:58025/api/v1/messages')).json();const message=messages.messages.find(m=>m.Subject==='Synthetic '+label);assert.ok(message);
 const body=await(await fetch('http://127.0.0.1:58025/api/v1/message/'+message.ID)).json();assert.equal(body.HTML,html);
 const match=body.HTML.match(/href="([^"]+)"/);assert.ok(match);const url=match[1].replaceAll('&amp;','&');assert.equal(new URL(url).origin,'http://127.0.0.1:3017');assert.equal(new URL(url).searchParams.get('type'),linkType);
 links.push({label,kind:linkType,url,email,password,userId:generated.data.user.id});checks.push(template+' template received through SMTP with a real generated Auth OTP');console.log('PASS '+checks.at(-1));return generated.data.user;
}
try{
 for(let i=0;i<40;i++){try{const r=await fetch('http://127.0.0.1:58025/readyz');if(r.ok)break;}catch{}await delay(250);if(i===39)throw new Error('Capture not ready');}
 const resend=process.argv.includes('--resend-invite');
 if(!resend){
  const signupEmail='fixo-test-'+run+'-emailsignup@local.invalid',signupPassword='Synthetic-'+randomUUID()+'9aA';
  await deliver('signup','emailSignup',signupEmail,signupPassword,'confirmation','email');
  const customer=manifest.actors.find(a=>a.label==='customerB');await deliver('recovery','emailRecovery',customer.email,null,'recovery');
 }
 const inviteEmail='fixo-test-'+run+'-emailinvite@local.invalid';const reserve=await operator.rpc('admin_reserve_invitation',{invite_email:inviteEmail,invite_name:'Synthetic email invite',invite_role:'customer',operation_id:randomUUID(),resend});assert.equal(reserve.error,null);assert.equal(reserve.data.send,true);manifest.invitations??=[];if(!manifest.invitations.includes(reserve.data.id))manifest.invitations.push(reserve.data.id);await persist();
 const invited=await deliver('invite',resend?'emailInviteResent':'emailInvite',inviteEmail,null,'invite');assert.equal((await admin.rpc('finish_invitation_delivery',{invitation_id:reserve.data.id,delivery_generation:reserve.data.generation,invited_user:invited.id,delivery_result:'sent'})).error,null);
 await writeFile(captureDir+'/links.json',JSON.stringify(links,null,2));const result={directory:captureDir,checks,status:'PASS local',hostedSmtp:'BLOCKED — not configured or changed',bridge:'Generated links rendered by test runner and submitted to local SMTP',resend};manifest.emailCaptures??=[];if(manifest.emailCapture&&!manifest.emailCaptures.some(x=>x.directory===manifest.emailCapture.directory))manifest.emailCaptures.push(manifest.emailCapture);manifest.emailCaptures.push(result);manifest.emailCapture=result;await persist();
 console.log(JSON.stringify({status:'PASS local',checks:checks.length,hostedSmtp:'NOT TESTED',links:captureDir+'/links.json'}));
}finally{child.kill();await new Promise(resolve=>child.once('exit',resolve));}
