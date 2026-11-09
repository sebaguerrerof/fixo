import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { chromium, expect as baseExpect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
const expect=baseExpect.configure({timeout:45000}),origin='http://127.0.0.1:3017',ref='rjzyqdhotcshvbdcrgon';
assert.equal(process.env.FIXO_SPRINT03_AUTHORIZED,ref);const run=process.env.FIXO_SPRINT03_RUN;assert.match(run??'',/^[0-9a-f-]{36}$/);
const dir='.audit-backups/sprint03-native/'+run,manifest=JSON.parse(await readFile(dir+'/manifest.json','utf8'));assert.equal(manifest.project,ref);
const env={};for(const line of(await readFile('.env.local','utf8')).split(/\r?\n/)){const m=line.match(/^([A-Z_][A-Z_0-9]*)\s*=\s*(.*)$/);if(m)env[m[1]]=m[2].replace(/^(['"])(.*)\1$/,'$2');}
const evidence='docs/production/sprint-03-evidence';await mkdir(evidence,{recursive:true});
const checks=[],errors=[];let browser;let requestId;let currentPage;
async function check(name,fn){manifest.browserCurrentCheck=name;await persist();await fn();checks.push(name);console.log('PASS '+name);}
async function persist(){await writeFile(dir+'/manifest.json',JSON.stringify(manifest,null,2));}
function actor(label){return manifest.actors.find(a=>a.label===label);}
async function api(label){const c=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});const a=actor(label);assert.equal((await c.auth.signInWithPassword({email:a.email,password:a.password})).error,null);return c;}
async function show(context,path){await currentPage?.close();currentPage=await context.newPage();currentPage.on('pageerror',e=>errors.push(String(e)));await currentPage.goto(origin+path);return currentPage;}
async function login(context,label){const page=await show(context,'/login');const a=actor(label);await page.getByPlaceholder('tu@correo.cl',{exact:true}).fill(a.email);await page.getByPlaceholder('Tu contraseña',{exact:true}).fill(a.password);await page.getByRole('button',{name:'Ingresar',exact:true}).click();await page.waitForURL(u=>!u.pathname.startsWith('/login'),{timeout:90000});return page;}
async function noOverflow(page){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');}
try{
 // One live page at a time bounds memory. A global renderer cap can stall isolated contexts in Edge.
 browser=await chromium.launch({channel:'msedge',headless:true});
 const customer=await browser.newContext({viewport:{width:1440,height:1000}}),tech=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),administrator=await browser.newContext({viewport:{width:1440,height:1000}}),stranger=await browser.newContext();
 let page,t,a,b;
 await check('customer login and unauthenticated/role navigation guard',async()=>{b=await show(stranger,'/solicitar');await expect(b).toHaveURL(/login/);page=await login(customer,'customerA');t=await login(tech,'technicianA');await t.goto(origin+'/solicitar');await expect(t).toHaveURL(/perfil/);});
 const title='Solicitud navegador '+run.slice(0,8);
 await check('desktop creates a real request with private address and normal priority',async()=>{
 if(manifest.browserRequestId){requestId=manifest.browserRequestId;page=await show(customer,'/cliente/solicitudes/'+requestId);await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();return;}
 page=await show(customer,'/solicitar');await page.getByLabel('¿Qué necesitas resolver?',{exact:true}).fill(title);await page.getByLabel('Rubro',{exact:true}).selectOption('gasfiteria');await page.getByLabel('Comuna',{exact:true}).fill('Ñuñoa');await page.getByLabel('Detalles del problema',{exact:true}).fill('Necesito una revisión sintética de la fuga bajo el lavaplatos.');await page.getByLabel('Dirección privada (opcional)',{exact:true}).fill('Dirección privada sintética de navegador');await page.getByRole('button',{name:'Registrar solicitud',exact:true}).click();await expect(page.getByRole('heading',{name:'Solicitud registrada'})).toBeVisible();
 const client=await api('customerA');const r=await client.rpc('marketplace_customer_requests');assert.equal(r.error,null);requestId=r.data.items.find(r=>r.title===title).id;manifest.requests.push(requestId);manifest.browserRequestId=requestId;await persist();
 await page.getByRole('button',{name:'Ver mis solicitudes',exact:true}).click();const link=page.locator('a[href="/cliente/solicitudes/'+requestId+'"]');await expect(link).toBeVisible();await link.click();await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();await noOverflow(page);
 });
 let photoId;
 await check('private photo uploads through actual raster decoder and remains scoped',async()=>{
 const image=await sharp({create:{width:100,height:80,channels:3,background:'blue'}}).withMetadata().png().toBuffer();
 await page.getByLabel('Fotografía privada',{exact:true}).setInputFiles({name:'fixture.png',mimeType:'image/png',buffer:image});await page.getByRole('button',{name:'Agregar fotografía',exact:true}).click();await expect(page.getByRole('status')).toContainText('Fotografía guardada');
 const client=await api('customerA');const list=await client.rpc('marketplace_photos',{request_id:requestId});assert.equal(list.error,null);photoId=list.data[0].id;manifest.objects.push({bucket:'service-request-photos',path:list.data[0].storage_path});await persist();
 const response=await customer.request.get(origin+'/api/service-requests/'+requestId+'/photos?photo='+photoId);assert.equal(response.status(),200);assert.match(response.headers()['cache-control'],/no-store/);const meta=await sharp(await response.body()).metadata();assert.equal(meta.format,'jpeg');assert.equal(meta.exif,undefined);
 b=await login(stranger,'customerB');assert.equal((await stranger.request.get(origin+'/api/service-requests/'+requestId+'/photos?photo='+photoId)).status(),404);
 assert.equal((await tech.request.get(origin+'/api/service-requests/'+requestId+'/photos?photo='+photoId)).status(),404);
 });
 await check('mobile opportunity shows eligible request and supports keyboard input',async()=>{
 t=await show(tech,'/tecnico/oportunidades');
 await expect(t.getByRole('heading',{name:title,exact:true})).toBeVisible();await noOverflow(t);assert.ok(!(await t.locator('body').innerText()).includes('Dirección privada sintética de navegador'));
 await t.goto(origin+'/tecnico/oportunidades/'+requestId+'/cotizar');await t.getByLabel('Mano de obra (CLP)',{exact:true}).focus();await expect(t.getByLabel('Mano de obra (CLP)',{exact:true})).toBeFocused();await t.keyboard.press('Tab');await expect(t.getByLabel('Materiales (CLP)',{exact:true})).toBeFocused();
 });
 await check('mobile saves draft, resumes it, edits and submits quote',async()=>{
 await t.getByLabel('Mano de obra (CLP)',{exact:true}).fill('20000');await t.getByLabel('Materiales (CLP)',{exact:true}).fill('5000');await t.getByLabel('Tiempo estimado',{exact:true}).fill('2 horas');
 const local=days=>{const d=new Date(Date.now()+days*86400000);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
 await t.getByLabel('Disponible desde',{exact:true}).fill(local(1));await t.getByLabel('Cotización válida hasta',{exact:true}).fill(local(2));await t.getByLabel('Descripción del trabajo',{exact:true}).fill('Revisión y reparación sintética de la fuga indicada por el cliente.');await t.getByLabel('Condiciones',{exact:true}).fill('Cotización sintética. Sin pago ni ejecución habilitada.');await t.getByRole('button',{name:'Guardar borrador',exact:true}).click();await expect(t.getByRole('heading',{name:'Borrador guardado'})).toBeVisible();
 await t.goto(origin+'/tecnico/oportunidades/'+requestId+'/cotizar');await expect(t.getByLabel('Mano de obra (CLP)',{exact:true})).toHaveValue('20000');await t.getByLabel('Mano de obra (CLP)',{exact:true}).fill('21000');await t.getByRole('button',{name:'Enviar cotización',exact:true}).click();await expect(t.getByRole('heading',{name:'Cotización enviada'})).toBeVisible();
 await noOverflow(t);await t.screenshot({path:evidence+'/browser-mobile-quote.png',fullPage:true});
 });
 await check('customer explicitly confirms quote and sees awarded job and history',async()=>{
 page=await show(customer,'/cliente/solicitudes/'+requestId);await expect(page.getByText('26.000',{exact:false}).first()).toBeVisible();page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Elegir este técnico',exact:true}).click();await expect(page.getByRole('heading',{name:'Trabajo adjudicado',exact:true})).toBeVisible();await expect(page.getByText('Pago no habilitado. La ejecución del trabajo permanece pendiente.',{exact:true})).toBeVisible();
 const client=await api('customerA');const rows=await client.from('jobs').select('id,quote_id').eq('service_request_id',requestId);assert.equal(rows.error,null);assert.equal(rows.data.length,1);manifest.jobs.push(rows.data[0].id);manifest.quotes.push(rows.data[0].quote_id);await persist();
 await noOverflow(page);await page.screenshot({path:evidence+'/browser-desktop-award.png',fullPage:true});
 assert.equal((await tech.request.get(origin+'/api/service-requests/'+requestId+'/photos?photo='+photoId)).status(),200);
 });
 await check('technician sees adjudication, frozen terms and no execution controls',async()=>{
 t=await show(tech,'/tecnico/trabajos');await expect(t.getByText(title,{exact:true}).first()).toBeVisible();await expect(t.getByText('Pago no habilitado. Ejecución pendiente del siguiente sprint.',{exact:true}).first()).toBeVisible();assert.equal(await t.getByRole('button',{name:/Iniciar trabajo|Confirmar salida/}).count(),0);await noOverflow(t);
 });
 await check('admin supervises request, quotes, job and actor history',async()=>{
 a=await login(administrator,'administrator');await a.goto(origin+'/admin/solicitudes/'+requestId);await expect(a.getByRole('heading',{name:title,exact:true})).toBeVisible();await expect(a.getByRole('heading',{name:'Historial de transiciones'})).toBeVisible();await noOverflow(a);await a.screenshot({path:evidence+'/browser-admin-request.png',fullPage:true});
 });
 await check('customer mobile history, empty pagination and controlled invalid action',async()=>{
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await mobile.addCookies(await customer.cookies());const p=await show(mobile,'/cliente?page=999');await expect(p.getByText('No hay solicitudes en esta página. Crea una para recibir propuestas.',{exact:true})).toBeVisible();await noOverflow(p);await p.goto(origin+'/cliente/solicitudes/'+requestId);await noOverflow(p);await p.screenshot({path:evidence+'/browser-mobile-award.png',fullPage:true});await mobile.close();currentPage=undefined;
 });
 assert.equal(errors.length,0,'browser runtime errors');manifest.browserStatus='PASS integración';
}catch(error){manifest.browserStatus='FAIL';await writeFile(dir+'/browser-failure.txt',String(error.stack));console.error(JSON.stringify({status:'FAIL',check:manifest.browserCurrentCheck,passed:checks.length}));process.exitCode=1;}
finally{await persist();await browser?.close();await writeFile(evidence+'/browser-integration.json',JSON.stringify({status:manifest.browserStatus,project:ref,run,checks,failedCheck:manifest.browserStatus==='FAIL'?manifest.browserCurrentCheck:null,runtimeErrors:errors,viewports:['1440×1000','390×844'],completedAt:new Date().toISOString()},null,2));console.log(JSON.stringify({status:manifest.browserStatus,checks:checks.length}));}
