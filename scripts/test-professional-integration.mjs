import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createInterface } from "node:readline";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { inspectDocument } from "./lib/inspect-document.mjs";
const ref="rjzyqdhotcshvbdcrgon";assert.equal(process.env.FIXO_EXISTING_PROJECT_AUTHORIZED,ref);
const env={};for(const line of (await readFile(".env.local","utf8")).split(/\r?\n/)){const m=line.match(/^([A-Z_][A-Z_0-9]*)\s*=\s*(.*)$/);if(m)env[m[1]]=m[2].replace(/^(['"])(.*)\1$/,"$2");}
assert.equal(new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname,ref+".supabase.co");
const config={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const client=()=>createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,config);
const admin=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,config);
const runId=randomUUID(),dir=".audit-backups/sprint02-native/"+runId;
await mkdir(dir,{recursive:true});
const manifest={runId,project:ref,actors:[],extraUsers:[],invitations:[],objects:[],documentIds:[],requirements:[]};
const checks=[];const lines=createInterface({input:process.stdin});const iterator=lines[Symbol.asyncIterator]();
async function persist(){await writeFile(dir+"/manifest.json",JSON.stringify(manifest,null,2));}
async function test(name,fn){manifest.currentCheck=name;await fn();checks.push(name);console.log("PASS "+name);}
async function actor(label,type="customer"){
 const email=`fixo-test-${runId}-${label}@local.invalid`,pw="Synthetic-"+randomUUID()+"9aA";
 const result=await admin.auth.admin.createUser({email,password:pw,email_confirm:true,user_metadata:{first_name:"Synthetic",last_name:label,phone:"+56912345678",terms_accepted:true,account_type:type,fixo_test_run:runId}});assert.equal(result.error,null);
 manifest.actors.push({label,id:result.data.user.id,email});await persist();const api=client();const login=await api.auth.signInWithPassword({email,password:pw});assert.equal(login.error,null);return{api,id:login.data.user.id};
}
const app=async a=>{const r=await a.api.rpc("professional_application");assert.equal(r.error,null);return r.data;};
const payload={city:"Ñuñoa",headline:"Servicios sintéticos de integración",bio:"Descripción sintética para verificar persistencia real y revisión profesional.",coverage:["Ñuñoa","Providencia"],categories:["electricidad"],primaryCategory:"electricidad",specialties:["Prueba sintética"],years:5,price:25000,availability:"Lunes a viernes de 9 a 18 horas",portfolio:["https://example.invalid/synthetic"]};
const save=async a=>a.api.rpc("save_professional_application",{payload,expected_revision:(await app(a)).revision,operation_id:randomUUID()});
const submit=async a=>a.api.rpc("submit_professional_application",{expected_revision:(await app(a)).revision,consent:true,operation_id:randomUUID()});
async function upload(a,requirement,bytes,replaces=null){const id=randomUUID(),path=a.id+"/"+id+".pdf";
 assert.equal((await a.api.storage.from("technician-documents").upload(path,bytes,{contentType:"application/pdf",cacheControl:"0"})).error,null);
 manifest.objects.push(path);manifest.documentIds.push(id);await persist();
 const r=await a.api.rpc("register_professional_document",{document_id:id,requirement,object_path:path,replaces});assert.equal(r.error,null);return{id,path,bytes};
}
async function scan(doc){const file=await admin.storage.from("technician-documents").download(doc.path);assert.equal(file.error,null);
 const result=await inspectDocument(Buffer.from(await file.data.arrayBuffer()),file.data.type);
 assert.equal((await admin.rpc("record_professional_inspection",{document_id:doc.id,content_sha256:result.sha256,content_mime:result.mime,content_size:result.size,scan_result:result.result,engine:result.engine})).error,null);return result;}
try{
 const t=await actor("technician-one","technician"),other=await actor("technician-two","technician"),c=await actor("customer-one"),m=await actor("moderator"),s=await actor("admin-one");
 manifest.stage="roles";await persist();console.log(JSON.stringify({checkpoint:"roles",manifest:dir+"/manifest.json"}));assert.equal((await iterator.next()).value?.trim(),"roles-ready");
 let requirement,doc,validBytes;
 await test("private application persists and cross-user reads fail",async()=>{
  assert.equal((await save(t)).error,null);const a=await app(t);assert.equal(a.profile.city,payload.city);assert.equal(a.state,"draft");assert.equal(a.published,false);
  assert.ok((await other.api.rpc("professional_application",{target:t.id})).error);assert.ok((await c.api.rpc("admin_professional_queue")).error);
 });
 await test("draft retries are idempotent and stale revisions fail",async()=>{
  const args={payload,expected_revision:(await app(t)).revision,operation_id:randomUUID()};const first=await t.api.rpc("save_professional_application",args);assert.equal(first.error,null);
  assert.equal((await t.api.rpc("save_professional_application",args)).data,first.data);
  assert.ok((await t.api.rpc("save_professional_application",{...args,operation_id:randomUUID()})).error);
 });
 await test("unconfigured category cannot be submitted",async()=>assert.ok((await submit(t)).error));
 await test("requirements are versioned by superadmin without inventing legal rules",async()=>{
  const args={category:"electricidad",key:"synthetic-"+runId.slice(0,8),requirement_kind:"internal",is_required:true,document_kind:"identity",description:"Synthetic internal integration criterion",source_url:null,reason:"Synthetic integration configuration"};
  assert.ok((await m.api.rpc("admin_version_requirement",args)).error);
  assert.ok((await s.api.rpc("admin_version_requirement",{...args,requirement_kind:"legal"})).error);
  const r=await s.api.rpc("admin_version_requirement",args);assert.equal(r.error,null);requirement=r.data;manifest.requirements.push(requirement);await persist();
 });
 await test("consent is required and technicians cannot approve themselves",async()=>{
  assert.ok((await t.api.rpc("submit_professional_application",{expected_revision:(await app(t)).revision,consent:false,operation_id:randomUUID()})).error);
  assert.ok((await t.api.rpc("admin_decide_professional_application",{target:t.id,decision:"approved",expected_revision:(await app(t)).revision,reason:"Forged approval",operation_id:randomUUID()})).error);
 });
 await test("valid PDF is quarantined and cannot be signed or downloaded",async()=>{
  const pdf=await PDFDocument.create();const font=await pdf.embedFont(StandardFonts.Helvetica);pdf.addPage().drawText("Fixo synthetic verification document",{font});validBytes=Buffer.from(await pdf.save());doc=await upload(t,requirement,validBytes);
  assert.ok((await t.api.storage.from("technician-documents").download(doc.path)).error);
  assert.ok((await s.api.storage.from("technician-documents").createSignedUrl(doc.path,60)).error);
  assert.equal((await other.api.from("technician_documents").select("id").eq("id",doc.id)).data.length,0);
  assert.ok((await other.api.rpc("register_professional_document",{document_id:randomUUID(),requirement,object_path:doc.path,replaces:null})).error);
 });
 await test("uninspected evidence cannot be approved",async()=>{
  assert.ok((await m.api.rpc("admin_review_professional_document",{document_id:doc.id,decision:"approved",reason:"Must remain quarantined"})).error);
  assert.equal((await submit(t)).error,null);
  assert.ok((await m.api.rpc("admin_decide_professional_application",{target:t.id,decision:"approved",expected_revision:(await app(t)).revision,reason:"Required document missing",operation_id:randomUUID()})).error);
 });
 await test("real binary parsing and ClamAV inspect stored PDF",async()=>{
  const result=await scan(doc);assert.equal(result.result,"clean");assert.match(result.engine,/^ClamAV /);
  assert.equal((await t.api.storage.from("technician-documents").download(doc.path)).error,null);
  assert.ok((await other.api.storage.from("technician-documents").download(doc.path)).error);
  assert.ok((await t.api.rpc("record_professional_inspection",{document_id:doc.id,content_sha256:result.sha256,content_mime:result.mime,content_size:result.size,scan_result:"clean",engine:"Forged scanner"})).error);
 });
 await test("administrative document review and information request are audited",async()=>{
  assert.equal((await m.api.rpc("admin_review_professional_document",{document_id:doc.id,decision:"approved",reason:"Synthetic document reviewed"})).error,null);
  assert.equal((await m.api.rpc("admin_decide_professional_application",{target:t.id,decision:"needs_information",expected_revision:(await app(t)).revision,reason:"Synthetic additional information",operation_id:randomUUID()})).error,null);
  const a=await app(t);assert.equal(a.state,"needs_information");assert.ok(a.history.some(e=>e.actor_id===m.id&&e.action==="application_decided"));assert.equal(a.published,false);
 });
 await test("correction and concurrent decisions publish exactly once",async()=>{
  assert.equal((await save(t)).error,null);assert.equal((await submit(t)).error,null);
  const args={target:t.id,decision:"approved",expected_revision:(await app(t)).revision,reason:"Synthetic complete review",operation_id:randomUUID()};
  const attempts=await Promise.all([m.api.rpc("admin_decide_professional_application",args),s.api.rpc("admin_decide_professional_application",{...args,operation_id:randomUUID()})]);assert.equal(attempts.filter(r=>!r.error).length,1);
  assert.equal((await app(t)).published,true);
  assert.equal((await client().from("technician_profiles").select("user_id").eq("user_id",t.id)).data.length,1);
  const winner=attempts[0].error?s:m;const winningOp=attempts[0].error?null:args;
  if(winningOp)assert.equal((await winner.api.rpc("admin_decide_professional_application",winningOp)).error,null);
 });
 await test("sensitive identity edit immediately withdraws publication",async()=>{
  assert.equal((await t.api.rpc("update_my_profile",{first_name:"Synthetic",last_name:"Changed",phone_number:"+56912345678",professional:null})).error,null);
  assert.equal((await app(t)).state,"draft");assert.equal((await client().from("technician_profiles").select("user_id").eq("user_id",t.id)).data.length,0);
 });
 await test("replacement is immutable and old evidence becomes inaccessible",async()=>{
  const replacement=await upload(t,requirement,validBytes,doc.id);assert.ok((await t.api.storage.from("technician-documents").download(doc.path,{cacheNonce:randomUUID()},{cache:"no-store"})).error);
  assert.equal((await scan(replacement)).result,"clean");assert.equal((await m.api.rpc("admin_review_professional_document",{document_id:replacement.id,decision:"approved",reason:"Synthetic replacement review"})).error,null);doc=replacement;
  assert.equal((await submit(t)).error,null);
  assert.equal((await m.api.rpc("admin_decide_professional_application",{target:t.id,decision:"approved",expected_revision:(await app(t)).revision,reason:"Synthetic replacement approved",operation_id:randomUUID()})).error,null);
 });
 await test("professional suspension hides directory and blocks old-session writes",async()=>{
  assert.equal((await m.api.rpc("admin_decide_professional_application",{target:t.id,decision:"suspended",expected_revision:(await app(t)).revision,reason:"Synthetic professional suspension",operation_id:randomUUID()})).error,null);
  assert.equal((await client().from("technician_profiles").select("user_id").eq("user_id",t.id)).data.length,0);assert.ok((await save(t)).error);
  assert.ok((await t.api.storage.from("technician-documents").upload(t.id+"/blocked.pdf",validBytes,{contentType:"application/pdf"})).error);
 });
 await test("disguised document is rejected by actual byte inspection",async()=>{
  assert.equal((await save(other)).error,null);const bad=await upload(other,requirement,Buffer.from("<html>synthetic invalid PDF</html>"));const result=await scan(bad);assert.equal(result.result,"unsafe");
  assert.ok((await s.api.rpc("admin_review_professional_document",{document_id:bad.id,decision:"approved",reason:"Must reject invalid content"})).error);
 });
 manifest.status="PASS";
}catch(error){manifest.status="FAIL";await writeFile(dir+"/failure.txt",String(error.stack));console.error(JSON.stringify({status:"FAIL",check:manifest.currentCheck,checksPassed:checks.length}));process.exitCode=1;}
finally{await persist();await writeFile("docs/production/sprint-02-evidence/professional-integration.json",JSON.stringify({project:ref,runId,status:manifest.status,checks,failedCheck:manifest.status==="FAIL"?manifest.currentCheck:null,fixtureCleanup:"PENDING",completedAt:new Date().toISOString()},null,2)+"\n");lines.close();console.log(JSON.stringify({status:manifest.status,checks:checks.length,manifest:dir+"/manifest.json"}));}
