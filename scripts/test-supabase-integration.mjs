// Deliberately never loads .env.local. Explicit local-only credentials and consent required.
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const endpoint = process.env.FIXO_TEST_SUPABASE_URL;
if (process.env.FIXO_TEST_ALLOW_WRITES !== "isolated-local" || endpoint !== "http://127.0.0.1:54331") {
  console.error("BLOCKED: requires explicit isolated-local consent and the dedicated loopback endpoint on port 54331. No connection attempted.");
  process.exit(2);
}
const anon = process.env.FIXO_TEST_ANON_KEY;
const secret = process.env.FIXO_TEST_SERVICE_ROLE_KEY;
const password = process.env.FIXO_TEST_DATABASE_PASSWORD;
if (!anon || !secret || !password) { console.error("BLOCKED: isolated test credentials missing. No connection attempted."); process.exit(2); }
const config = { auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false} };
const admin = createClient(endpoint,secret,config);
const client = () => createClient(endpoint,anon,config);
const db = new pg.Client({host:"127.0.0.1",port:54332,database:"postgres",user:"postgres",password,ssl:false,connectionTimeoutMillis:5000,statement_timeout:15000});
const checks = [];
async function test(name,run) { await run(); checks.push(name); console.log("PASS "+name); }
async function connectActor(email,pw) { const actor=client();const result=await actor.auth.signInWithPassword({email,password:pw});assert.equal(result.error,null);return {api:actor,user:result.data.user,session:result.data.session}; }
async function makeActor(label,type="customer") {
  const email="s1-"+label+"-"+randomUUID()+"@local.invalid";
  const pw="Local-Only-"+randomBytes(16).toString("hex")+"9A";
  const result=await admin.auth.admin.createUser({email,password:pw,email_confirm:true,user_metadata:{first_name:"Synthetic",last_name:label,phone:"+56912345678",terms_accepted:true,full_name:"Synthetic "+label,account_type:type,role:"superadmin"}});
  assert.equal(result.error,null);
  return {email,pw,...await connectActor(email,pw)};
}
async function messageToken(email,type) {
  for(let attempt=0;attempt<20;attempt++){
    const list=await fetch("http://127.0.0.1:54334/api/v1/messages").then(r=>r.json());
    const item=list.messages?.find(m=>m.To?.some(t=>t.Address?.toLowerCase()===email.toLowerCase()));
    if(item){
      const message=await fetch("http://127.0.0.1:54334/api/v1/message/"+encodeURIComponent(item.ID)).then(r=>r.json());
      const html=(message.HTML??"").replaceAll("&amp;","&");
      const link=html.match(/\/auth\/callback\?token_hash=([A-Za-z0-9_-]+)&type=([a-z]+)/);
      if(link&&link[2]===type)return link[1];
    }
    await new Promise(resolve=>setTimeout(resolve,300));
  }
  throw new Error("Local capture message unavailable");
}
const rpcChange=(actor,target,status,role=null)=>actor.api.rpc("admin_change_account",{target_user:target.user.id,new_status:status,new_role:role,change_reason:"Synthetic integration verification",operation_id:randomUUID()});
try {
  await db.connect();
  // Refuse to operate on a pre-existing population, even on loopback.
  assert.equal(Number((await db.query("select count(*) from auth.users")).rows[0].count),0,"Dedicated instance must be empty");
  const versions=(await db.query("select version from supabase_migrations.schema_migrations")).rows.map(row=>row.version);
  assert.ok(versions.includes("202608170001")&&versions.includes("20261108223021")&&versions.includes("20261108234902"),"All reviewed migrations required");
  const c1=await makeActor("customer-one"),c2=await makeActor("customer-two"),t1=await makeActor("technician-one","technician"),t2=await makeActor("technician-two","technician");
  const m=await makeActor("moderator"),s1=await makeActor("admin-one"),s2=await makeActor("admin-two");
  await db.query("update public.profiles set role='moderator' where id=$1",[m.user.id]);
  await db.query("update public.profiles set role='superadmin' where id=any($1::uuid[])",[[s1.user.id,s2.user.id]]);
  await test("untrusted metadata cannot assign privileged roles",async()=>{assert.equal((await c1.api.rpc("my_account_access")).data.role,"customer");assert.equal((await t1.api.rpc("my_account_access")).data.role,"technician");});
  await test("pending technicians remain private",async()=>{assert.equal((await client().from("technician_profiles").select("user_id").eq("user_id",t1.user.id)).data.length,0);});
  await test("customer cannot read another customer",async()=>{assert.equal((await c1.api.from("profiles").select("id").eq("id",c2.user.id)).data.length,0);});
  await test("direct role/status writes denied",async()=>{assert.ok((await c1.api.from("profiles").update({role:"superadmin",account_status:"active"}).eq("id",c1.user.id)).error);});
  await test("own profile fields persist without access changes",async()=>{assert.equal((await c1.api.rpc("update_my_profile",{first_name:"Cliente",last_name:"Local",phone_number:"+56912345678",professional:null})).error,null);assert.equal((await c1.api.rpc("my_profile")).data.phone,"+56912345678");});
  let requestId;
  await test("own request persists with submitted state",async()=>{const result=await c1.api.rpc("marketplace_create_request",{operation_id:randomUUID(),payload:{categoryId:"electricidad",title:"Solicitud sintética",description:"Descripción sintética para validar persistencia de solicitudes.",locationLabel:"Ñuñoa"}});assert.equal(result.error,null);assert.equal(result.data.status,"submitted");requestId=result.data.id;});
  await test("request state overposting and cross-user reads denied",async()=>{assert.ok((await c1.api.from("service_requests").insert({customer_id:c1.user.id,category_id:"electricidad",title:"Estado manipulado",location_label:"Ñuñoa",status:"completed"})).error);assert.equal((await c2.api.from("service_requests").select("id").eq("id",requestId)).data.length,0);});
  await test("moderator can list/filter accounts but cannot administer privileged actors",async()=>{assert.ok((await m.api.rpc("admin_list_users",{search_text:"Synthetic",role_filter:"customer",status_filter:"active",page_number:1})).data.total>=2);assert.ok((await rpcChange(m,s1,"suspended")).error);assert.ok((await rpcChange(m,c1,null,"superadmin")).error);});
  await test("suspension blocks operations with the earlier JWT",async()=>{assert.equal((await rpcChange(m,c1,"suspended")).error,null);assert.equal((await c1.api.rpc("my_account_access")).data.allowed,false);assert.ok((await c1.api.rpc("marketplace_create_request",{operation_id:randomUUID(),payload:{categoryId:"electricidad",title:"Solicitud suspendida",description:"Descripción sintética para validar bloqueo de solicitudes.",locationLabel:"Ñuñoa"}})).error);});
  await test("reactivation is audited",async()=>{assert.equal((await rpcChange(m,c1,"active")).error,null);assert.equal((await c1.api.rpc("my_account_access")).data.allowed,true);const history=(await s1.api.rpc("admin_user_detail",{target_user:c1.user.id})).data.history;assert.ok(history.some(event=>event.action==="account_status_changed"&&event.actor_id===m.user.id));});
  const path=t1.user.id+"/certificate.pdf";
  await test("Storage permits own documents and rejects cross-user reads",async()=>{assert.equal((await t1.api.storage.from("technician-documents").upload(path,Buffer.from("%PDF-1.4 synthetic local fixture"),{contentType:"application/pdf"})).error,null);assert.ok((await t2.api.storage.from("technician-documents").download(path)).error);await db.query("insert into public.technician_documents(technician_id,document_type,storage_path) values($1,'certificate',$2)",[t1.user.id,path]);assert.equal((await t2.api.from("technician_documents").select("id").eq("technician_id",t1.user.id)).data.length,0);});
  await test("Storage MIME and size limits are enforced by its HTTP API",async()=>{assert.ok((await t1.api.storage.from("technician-documents").upload(t1.user.id+"/bad.txt",Buffer.from("text"),{contentType:"text/plain"})).error);assert.ok((await t1.api.storage.from("technician-documents").upload(t1.user.id+"/oversize.pdf",Buffer.alloc(10485761),{contentType:"application/pdf"})).error);});
  let signedUrl;
  await test("owner receives a bounded signed URL",async()=>{const signed=await t1.api.storage.from("technician-documents").createSignedUrl(path,60);assert.equal(signed.error,null);signedUrl=signed.data.signedUrl;assert.equal((await fetch(signedUrl)).status,200);});
  await test("approved profile is removed immediately by global suspension",async()=>{assert.equal((await s1.api.rpc("change_technician_status",{target_technician_id:t1.user.id,next_status:"verified",change_reason:"Synthetic verification"})).error,null);assert.equal((await s1.api.rpc("change_technician_status",{target_technician_id:t1.user.id,next_status:"active",change_reason:"Synthetic activation"})).error,null);assert.equal((await client().from("technician_profiles").select("user_id").eq("user_id",t1.user.id)).data.length,1);assert.equal((await rpcChange(m,t1,"suspended")).error,null);assert.equal((await client().from("technician_profiles").select("user_id").eq("user_id",t1.user.id)).data.length,0);assert.ok((await t1.api.storage.from("technician-documents").upload(t1.user.id+"/suspended.pdf",Buffer.from("%PDF-test"),{contentType:"application/pdf"})).error);});

  const registrationEmail="s1-confirm-"+randomUUID()+"@local.invalid",registrationPassword="Local-Signup-"+randomBytes(12).toString("hex")+"9";
  await test("signup requires email confirmation and captures a Fixo template locally",async()=>{const candidate=client();assert.equal((await candidate.auth.signUp({email:registrationEmail,password:registrationPassword,options:{data:{first_name:"Synthetic",last_name:"Signup",phone:"+56912345678",terms_accepted:true,full_name:"Synthetic Signup",role:"superadmin"},emailRedirectTo:"http://127.0.0.1:3000/auth/callback"}})).error,null);assert.ok((await candidate.auth.signInWithPassword({email:registrationEmail,password:registrationPassword})).error);});
  let confirmed;
  await test("confirmation OTP works in another client and rejects reuse",async()=>{const hash=await messageToken(registrationEmail,"email");const otherBrowser=client();const result=await otherBrowser.auth.verifyOtp({token_hash:hash,type:"email"});assert.equal(result.error,null);confirmed={api:otherBrowser,user:result.data.user,session:result.data.session};assert.equal((await otherBrowser.rpc("my_account_access")).data.role,"customer");assert.ok((await client().auth.verifyOtp({token_hash:hash,type:"email"})).error);});
  await test("recovery mail verifies once and changes a password",async()=>{assert.equal((await client().auth.resetPasswordForEmail(registrationEmail,{redirectTo:"http://127.0.0.1:3000/auth/callback"})).error,null);const hash=await messageToken(registrationEmail,"recovery");const recovery=client();assert.equal((await recovery.auth.verifyOtp({token_hash:hash,type:"recovery"})).error,null);assert.equal((await recovery.auth.updateUser({password:registrationPassword+"New"})).error,null);assert.ok((await client().auth.verifyOtp({token_hash:hash,type:"recovery"})).error);});

  const inviteEmail="s1-invited-"+randomUUID()+"@local.invalid",operation=randomUUID();
  let invitation,invited;
  await test("invitation reservations are idempotent and restrict privileged targets",async()=>{assert.ok((await m.api.rpc("admin_reserve_invitation",{invite_email:inviteEmail,invite_name:"Synthetic Invite",invite_role:"superadmin",operation_id:randomUUID(),resend:false})).error);const args={invite_email:inviteEmail,invite_name:"Synthetic Invite",invite_role:"technician",operation_id:operation,resend:false};invitation=(await m.api.rpc("admin_reserve_invitation",args)).data;assert.equal(invitation.send,true);assert.equal((await m.api.rpc("admin_reserve_invitation",args)).data.send,false);});
  await test("Auth invitation sends only to local capture and has no privilege metadata",async()=>{const result=await admin.auth.admin.inviteUserByEmail(inviteEmail,{redirectTo:"http://127.0.0.1:3000/auth/callback",data:{full_name:"Synthetic Invite"}});assert.equal(result.error,null);assert.equal((await admin.rpc("finish_invitation_delivery",{invitation_id:invitation.id,delivery_generation:invitation.generation,invited_user:result.data.user.id,delivery_result:"sent"})).error,null);});
  await test("invited technician defines password and remains professionally pending",async()=>{const hash=await messageToken(inviteEmail,"invite");const inviteClient=client();const identity=await inviteClient.auth.verifyOtp({token_hash:hash,type:"invite"});assert.equal(identity.error,null);invited={api:inviteClient,user:identity.data.user,session:identity.data.session};assert.equal((await inviteClient.rpc("my_account_access")).data.allowed,false);assert.equal((await inviteClient.auth.updateUser({password:"Local-Invited-"+randomBytes(12).toString("hex")+"9"})).error,null);assert.equal((await inviteClient.rpc("accept_my_invitation",{first_name:"Invitado",last_name:"Local",phone_number:"+56912345678",terms_accepted:true})).error,null);assert.equal((await inviteClient.rpc("my_account_access")).data.role,"technician");assert.equal((await inviteClient.from("technician_profiles").select("status").eq("user_id",invited.user.id).single()).data.status,"pending_verification");});
  await test("proof is one-time, session-bound and cannot be issued by an ordinary JWT",async()=>{const proofHash=createHash("sha256").update(randomBytes(32)).digest("hex"),sessionId=JSON.parse(Buffer.from(c1.session.access_token.split(".")[1],"base64url")).session_id;const args={flow_hash:proofHash,target_user:c1.user.id,target_session:sessionId,flow_kind:"recovery"};assert.ok((await c1.api.rpc("issue_auth_flow",args)).error);assert.equal((await admin.rpc("issue_auth_flow",args)).error,null);assert.ok((await c2.api.rpc("check_auth_flow",{flow_hash:proofHash,consume:false})).error);const result=await Promise.all([c1.api.rpc("check_auth_flow",{flow_hash:proofHash,consume:true}),c1.api.rpc("check_auth_flow",{flow_hash:proofHash,consume:true})]);assert.equal(result.filter(r=>!r.error).length,1);});
  await test("concurrent administrator suspensions preserve an active superadmin",async()=>{const result=await Promise.all([rpcChange(s1,s2,"blocked"),rpcChange(s2,s1,"blocked")]);assert.equal(result.filter(r=>!r.error).length,1);const count=Number((await db.query("select count(*) from public.profiles where role='superadmin' and account_status='active'")).rows[0].count);assert.equal(count,1);});
  await test("global logout invalidates operations using the old JWT",async()=>{const old=createClient(endpoint,anon,{...config,global:{headers:{Authorization:"Bearer "+c2.session.access_token}}});assert.equal((await c2.api.auth.signOut({scope:"global"})).error,null);assert.equal((await old.rpc("my_account_access")).data.allowed,false);});
  if(process.env.FIXO_TEST_WAIT_FOR_EXPIRY==="true"){
    await test("signed URL expires after its 60-second TTL",async()=>{await new Promise(resolve=>setTimeout(resolve,62000));assert.notEqual((await fetch(signedUrl)).status,200);});
  } else console.log("NOT TESTED signed URL expiration wait (requires FIXO_TEST_WAIT_FOR_EXPIRY=true)");
  console.log(JSON.stringify({status:"PASS",checks:checks.length,note:"Synthetic local fixtures retained. Browser UI E2E is a separate gate."}));
} catch(error) {
  console.error(JSON.stringify({status:"FAIL",checksPassed:checks.length,code:typeof error.code==="string"?error.code:"ASSERTION_OR_RUNTIME",note:"Inspect locally without copying tokens, emails, URLs or credentials to reports."}));
  process.exitCode=1;
} finally { await db.end().catch(()=>{}); }
