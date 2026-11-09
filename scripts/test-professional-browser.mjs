// Real browser + Next.js server actions + Fixo Auth/REST/Storage. No personal browser profile.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile,writeFile,mkdir } from "node:fs/promises";
import { createInterface } from "node:readline";
import { createClient } from "@supabase/supabase-js";
import { chromium,expect as baseExpect } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { inspectDocument } from "./lib/inspect-document.mjs";
const expect=baseExpect.configure({timeout:45000});
const ref="rjzyqdhotcshvbdcrgon";assert.equal(process.env.FIXO_EXISTING_PROJECT_AUTHORIZED,ref);
const origin=process.env.FIXO_BROWSER_TEST_URL;assert.equal(origin,"http://127.0.0.1:3017");
const env={};for(const line of (await readFile(".env.local","utf8")).split(/\r?\n/)){const m=line.match(/^([A-Z_][A-Z_0-9]*)\s*=\s*(.*)$/);if(m)env[m[1]]=m[2].replace(/^(['"])(.*)\1$/,"$2");}
assert.equal(new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname,ref+".supabase.co");
const cfg={auth:{persistSession:false,autoRefreshToken:false}};const admin=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,cfg);
const runId=process.env.FIXO_BROWSER_REUSE_RUN??randomUUID();assert.match(runId,/^[0-9a-f-]{36}$/);const dir=".audit-backups/sprint02-native/"+runId;await mkdir(dir,{recursive:true});
const manifest=process.env.FIXO_BROWSER_REUSE_RUN?JSON.parse(await readFile(dir+"/manifest.json","utf8")):{runId,project:ref,actors:[],extraUsers:[],invitations:[],objects:[],documentIds:[],requirements:[]};
assert.equal(manifest.project,ref);assert.equal(manifest.runId,runId);
const checks=[],errors=[];let browser;const lines=createInterface({input:process.stdin});const iterator=lines[Symbol.asyncIterator]();
async function persist(){await writeFile(dir+"/manifest.json",JSON.stringify(manifest,null,2));}
async function test(name,fn){manifest.currentCheck=name;await fn();checks.push(name);console.log("PASS "+name);}
async function make(label,type){const email=`fixo-test-${runId}-${label}@local.invalid`,pw="Synthetic-"+randomUUID()+"9aA";
 const existing=manifest.actors.find(a=>a.label===label);let r;
 if(existing){const found=await admin.auth.admin.getUserById(existing.id);assert.equal(found.error,null);assert.equal(found.data.user.user_metadata.fixo_test_run,runId);assert.equal(found.data.user.email,email);r=await admin.auth.admin.updateUserById(existing.id,{password:pw});}
 else{r=await admin.auth.admin.createUser({email,password:pw,email_confirm:true,user_metadata:{first_name:"Synthetic",last_name:label,phone:"+56912345678",terms_accepted:true,account_type:type,fixo_test_run:runId}});if(!r.error)manifest.actors.push({label,id:r.data.user.id,email});}
 assert.equal(r.error,null);await persist();
 const api=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,cfg);assert.equal((await api.auth.signInWithPassword({email,password:pw})).error,null);return{email,pw,id:r.data.user.id,api};}
async function login(page,actor){await page.goto(origin+"/login");await page.getByPlaceholder("tu@correo.cl",{exact:true}).fill(actor.email);await page.getByPlaceholder("Tu contraseña",{exact:true}).fill(actor.pw);await page.getByRole("button",{name:"Ingresar",exact:true}).click();await page.waitForURL(url=>!url.pathname.startsWith("/login"),{timeout:90000});}
const application=async actor=>{const r=await actor.api.rpc("professional_application");assert.equal(r.error,null);return r.data;};
async function noOverflow(page){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),"Horizontal page overflow");}
try{
 const technician=await make("technician-one","technician"),superadmin=await make("admin-one","customer");manifest.stage="roles";await persist();console.log(JSON.stringify({checkpoint:"roles",manifest:dir+"/manifest.json"}));assert.equal((await iterator.next()).value?.trim(),"roles-ready");
 browser=await chromium.launch({channel:"msedge",headless:true,args:["--renderer-process-limit=1"]});
 const desktop=await browser.newContext({viewport:{width:1440,height:1000}}),mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),adminContext=await browser.newContext({viewport:{width:1440,height:1000}});
 const page=await desktop.newPage(),adminPage=await adminContext.newPage();for(const p of [page,adminPage])p.on("pageerror",e=>errors.push(String(e)));
 await test("browser authenticates real technician and superadmin with session cookies",async()=>{await login(page,technician);await login(adminPage,superadmin);assert.ok((await desktop.cookies()).some(c=>c.name.startsWith("sb-")));});
 const key="browser-"+runId.slice(0,8);
 await test("superadmin configures an internal category requirement through the UI",async()=>{
  await adminPage.goto(origin+"/admin/requisitos?category=gasfiteria");await adminPage.getByLabel("Clave del requisito").fill(key);await adminPage.getByLabel("Obligatorio para publicar").check();await adminPage.getByLabel("Descripción del criterio").fill("Synthetic browser internal identity criterion");await adminPage.getByLabel("Motivo de la versión").fill("Synthetic browser integration configuration");await adminPage.getByRole("button",{name:"Guardar nueva versión"}).click();await expect(adminPage.getByRole("status")).toContainText("Nueva versión guardada",{timeout:90000});
  const rules=await superadmin.api.rpc("professional_requirements",{category:"gasfiteria"});assert.equal(rules.error,null);manifest.requirements.push(rules.data.find(r=>r.requirement_key===key).id);await persist();
 });
 await test("technician saves a draft through Next.js server actions",async()=>{
  await page.goto(origin+"/tecnico/postulacion");await expect(page.getByRole("heading",{name:"Mi postulación profesional",exact:true})).toBeVisible();
  await page.getByLabel("Comuna base",{exact:true}).fill("Ñuñoa");await page.getByLabel("Presentación profesional",{exact:true}).fill("Postulación sintética de navegador");await page.getByLabel("Comunas de cobertura, separadas por coma",{exact:true}).fill("Ñuñoa, Providencia");await page.getByLabel("Experiencia y servicios",{exact:true}).fill("Antecedentes sintéticos de navegador para validar persistencia y revisión real.");await page.getByLabel("Gasfitería",{exact:true}).check();await page.getByLabel("Rubro principal",{exact:true}).selectOption("gasfiteria");await page.getByLabel("Disponibilidad",{exact:true}).fill("Lunes a viernes de 9 a 18 horas");await page.getByRole("button",{name:"Guardar borrador",exact:true}).click();await expect(page.getByRole("status")).toContainText("Borrador guardado",{timeout:90000});
  assert.equal((await application(technician)).primary_category,"gasfiteria");await page.screenshot({path:"docs/production/sprint-02-evidence/browser-desktop-application.png",fullPage:true});
 });
 let document;
 await test("browser rejects disguised PDF and uploads valid bytes into quarantine",async()=>{
  const file=page.locator('input[type="file"]').first();await expect(file).toBeVisible();await file.setInputFiles({name:"fake.pdf",mimeType:"application/pdf",buffer:Buffer.from("<html>synthetic invalid PDF</html>")});await page.getByRole("button",{name:"Cargar o reemplazar antecedente"}).first().click();await expect(page.getByRole("status")).toContainText("No se confirmó la carga",{timeout:90000});
  const pdf=await PDFDocument.create();pdf.addPage();const bytes=Buffer.from(await pdf.save());await file.setInputFiles({name:"synthetic.pdf",mimeType:"application/pdf",buffer:bytes});await page.getByRole("button",{name:"Cargar o reemplazar antecedente"}).first().click();await expect(page.getByRole("status")).toContainText("Documento recibido en cuarentena",{timeout:90000});
  document=(await application(technician)).documents.find(d=>d.current_document);assert.ok(document);manifest.objects.push(document.storage_path);manifest.documentIds.push(document.id);await persist();
  assert.equal((await desktop.request.get(origin+"/api/technician-documents/"+document.id)).status(),404);
 });
 await test("trusted worker scans real stored bytes before browser download",async()=>{
  const download=await admin.storage.from("technician-documents").download(document.storage_path,{cacheNonce:randomUUID()},{cache:"no-store"});assert.equal(download.error,null);
  const result=await inspectDocument(Buffer.from(await download.data.arrayBuffer()),download.data.type);assert.equal(result.result,"clean");
  assert.equal((await admin.rpc("record_professional_inspection",{document_id:document.id,content_sha256:result.sha256,content_mime:result.mime,content_size:result.size,scan_result:result.result,engine:result.engine})).error,null);
  const response=await desktop.request.get(origin+"/api/technician-documents/"+document.id);assert.equal(response.status(),200);assert.match(response.headers()["cache-control"],/no-store/);assert.match(response.headers()["content-disposition"],/^attachment/);
 });
 await test("browser submits with consent and administrator reviews document and application",async()=>{
  await page.reload();await page.getByLabel("Confirmo que los antecedentes declarados",{exact:false}).check();await page.getByRole("button",{name:"Enviar postulación",exact:true}).click();await expect(page.getByRole("status")).toContainText("Postulación enviada",{timeout:90000});
  await adminPage.goto(origin+"/admin/postulaciones/"+technician.id);
  const documentForm=adminPage.locator("article").filter({has:adminPage.getByRole("heading",{name:"Identidad · Vigente"})}).locator("form");
  await documentForm.getByLabel("Decisión",{exact:true}).selectOption("approved");await documentForm.getByLabel("Motivo de la decisión",{exact:true}).fill("Synthetic browser document review");await documentForm.getByRole("button",{name:"Registrar revisión"}).click();await expect(documentForm.getByRole("status")).toContainText("registrada",{timeout:90000});
  const decision=adminPage.locator("aside form");await decision.getByLabel("Decisión",{exact:true}).selectOption("approved");await decision.getByLabel("Motivo de la decisión",{exact:true}).fill("Synthetic browser application approved");await decision.getByRole("button",{name:"Registrar revisión"}).click();await expect(decision.getByRole("status")).toContainText("Decisión registrada",{timeout:90000});assert.equal((await application(technician)).published,true);
  await expect(adminPage.getByText(/Estado: Aprobada/)).toBeVisible({timeout:90000});
  await expect(adminPage.getByRole("heading",{name:"Decidir postulación"}).locator("..").getByLabel("Decisión",{exact:true})).toHaveValue("");
  await adminPage.screenshot({path:"docs/production/sprint-02-evidence/browser-admin-review.png",fullPage:true});
 });
 await test("mobile layout and keyboard navigation work with a real session",async()=>{
  await mobile.addCookies(await desktop.cookies());const p=await mobile.newPage();p.on("pageerror",e=>errors.push(String(e)));await p.goto(origin+"/tecnico/postulacion");await expect(p.getByRole("heading",{name:"Mi postulación profesional",exact:true})).toBeVisible();await noOverflow(p);await p.getByLabel("Comuna base",{exact:true}).focus();await expect(p.getByLabel("Comuna base",{exact:true})).toBeFocused();await p.keyboard.press("Tab");await expect(p.getByLabel("Presentación profesional",{exact:true})).toBeFocused();await p.screenshot({path:"docs/production/sprint-02-evidence/browser-mobile-application.png",fullPage:true});
 });
 await test("old browser session loses access immediately after global suspension",async()=>{
  assert.equal((await superadmin.api.rpc("admin_change_account",{target_user:technician.id,new_status:"suspended",new_role:null,change_reason:"Synthetic browser suspension",operation_id:randomUUID()})).error,null);
  assert.equal((await desktop.request.get(origin+"/api/technician-documents/"+document.id)).status(),404);await page.goto(origin+"/tecnico/postulacion");await expect(page).toHaveURL(/cuenta-no-disponible/,{timeout:90000});
 });
 assert.equal(errors.length,0,"Unexpected browser runtime errors");manifest.status="PASS";
}catch(error){manifest.status="FAIL";await writeFile(dir+"/failure.txt",String(error.stack));console.error(JSON.stringify({status:"FAIL",check:manifest.currentCheck,checksPassed:checks.length}));process.exitCode=1;}
finally{await persist();await writeFile(dir+"/browser-errors.json",JSON.stringify(errors));await browser?.close();lines.close();await writeFile("docs/production/sprint-02-evidence/browser-integration.json",JSON.stringify({project:ref,runId,status:manifest.status,checks,failedCheck:manifest.status==="FAIL"?manifest.currentCheck:null,runtimeErrors:errors.length,viewports:[{width:1440,height:1000},{width:390,height:844}],browser:"Microsoft Edge headless, isolated contexts",fixtureCleanup:"PENDING",completedAt:new Date().toISOString()},null,2)+"\n");console.log(JSON.stringify({status:manifest.status,checks:checks.length,manifest:dir+"/manifest.json"}));}
