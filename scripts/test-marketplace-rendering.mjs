// Read-only rendering regression after fixing Badge's invalid div-inside-p HTML.
import assert from 'node:assert/strict';import{readFile,writeFile}from'node:fs/promises';import{chromium,expect as baseExpect}from'@playwright/test';import{createClient}from'@supabase/supabase-js';import{randomUUID}from'node:crypto';
const ref='rjzyqdhotcshvbdcrgon',run=process.env.FIXO_SPRINT03_RUN;assert.equal(process.env.FIXO_SPRINT03_AUTHORIZED,ref);assert.match(run??'',/^[0-9a-f-]{36}$/);
const file='.audit-backups/sprint03-native/'+run+'/manifest.json',m=JSON.parse(await readFile(file,'utf8')),id=m.browserRequestId;assert.equal(m.project,ref);assert.match(id,/^[0-9a-f-]{36}$/);
const env={};for(const line of(await readFile('.env.local','utf8')).split(/\r?\n/)){const x=line.match(/^([A-Z_][A-Z_0-9]*)\s*=\s*(.*)$/);if(x)env[x[1]]=x[2].replace(/^(['"])(.*)\1$/,'$2');}
const expect=baseExpect.configure({timeout:45000}),errors=[],checks=[];let browser,context;
async function session(label,mobile=false){await context?.close();context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile});const p=await context.newPage();p.on('pageerror',e=>errors.push(String(e)));const a=m.actors.find(a=>a.label===label);await p.goto('http://127.0.0.1:3017/login');await p.getByPlaceholder('tu@correo.cl',{exact:true}).fill(a.email);await p.getByPlaceholder('Tu contraseña',{exact:true}).fill(a.password);await p.getByRole('button',{name:'Ingresar',exact:true}).click();await p.waitForURL(u=>!u.pathname.startsWith('/login'),{timeout:90000});return p;}
async function verify(p,path,heading,screenshot){await p.goto('http://127.0.0.1:3017'+path);await expect(p.getByRole('heading',{name:heading,exact:true})).toBeVisible();assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.screenshot({path:'docs/production/sprint-03-evidence/'+screenshot,fullPage:true});checks.push(path);console.log('PASS render '+path);}
try{
 browser=await chromium.launch({channel:'msedge',headless:true});let p=await session('customerA');await verify(p,'/cliente/solicitudes/'+id,'Trabajo adjudicado','browser-desktop-award.png');
 p=await session('customerA',true);await verify(p,'/cliente/solicitudes/'+id,'Trabajo adjudicado','browser-mobile-award.png');
 p=await session('technicianA',true);await verify(p,'/tecnico/trabajos','Trabajos adjudicados','browser-mobile-jobs.png');
 p=await session('administrator');await verify(p,'/admin/solicitudes/'+id,'Solicitud navegador '+run.slice(0,8),'browser-admin-request.png');
 // A stale assigned-technician cookie loses access to private photographs after suspension.
 const adminActor=m.actors.find(a=>a.label==='administrator'),tech=m.actors.find(a=>a.label==='technicianA');
 const admin=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});assert.equal((await admin.auth.signInWithPassword({email:adminActor.email,password:adminActor.password})).error,null);
 const photos=m.objects.filter(o=>o.bucket==='service-request-photos'&&o.path.includes('/'+id+'/'));assert.ok(photos.length);const photoId=photos[0].path.split('/').at(-1).replace('.jpg','');
 p=await session('technicianA',true);const url='http://127.0.0.1:3017/api/service-requests/'+id+'/photos?photo='+photoId;assert.equal((await context.request.get(url)).status(),200);
 try{assert.equal((await admin.rpc('admin_change_account',{target_user:tech.id,new_status:'suspended',new_role:null,change_reason:'Synthetic post-award privacy regression',operation_id:randomUUID()})).error,null);assert.equal((await context.request.get(url)).status(),404);}
 finally{assert.equal((await admin.rpc('admin_change_account',{target_user:tech.id,new_status:'active',new_role:null,change_reason:'Synthetic privacy regression reverted',operation_id:randomUUID()})).error,null);}
 assert.equal((await context.request.get(url)).status(),200);checks.push('assigned private photo denied after suspension with old cookie');
 assert.equal(errors.length,0,'unexpected browser runtime errors');
 const original=JSON.parse(await readFile('docs/production/sprint-03-evidence/browser-integration.json','utf8'));assert.equal(original.run,run);assert.equal(original.checks.length,9);
 await writeFile('docs/production/sprint-03-evidence/browser-before-badge-fix.json',JSON.stringify(original,null,2));
 original.status='PASS integración';original.failedCheck=null;original.runtimeErrors=[];original.resolvedFindings=['server-side dashboard role gate removes duplicate browser Auth wait','Badge is now a span, avoiding invalid div-in-p hydration'];original.finalRenderingRegression='browser-rendering.json';original.completedAt=new Date().toISOString();await writeFile('docs/production/sprint-03-evidence/browser-integration.json',JSON.stringify(original,null,2));m.browserStatus='PASS integración';
 m.rendering={status:'PASS integración',checks,runtimeErrors:0};
}catch(e){m.rendering={status:'FAIL',checks,runtimeErrors:errors};await writeFile('.audit-backups/sprint03-native/'+run+'/rendering-failure.txt',String(e.stack));process.exitCode=1;}
finally{await context?.close();await browser?.close();await writeFile(file,JSON.stringify(m,null,2));await writeFile('docs/production/sprint-03-evidence/browser-rendering.json',JSON.stringify(m.rendering,null,2));console.log(JSON.stringify(m.rendering));}
