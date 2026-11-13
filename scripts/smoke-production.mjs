import { spawn } from "node:child_process";
import { createServer } from "node:net";
import assert from "node:assert/strict";

// Same-process orchestration avoids cross-sandbox loopback assumptions.
const listener = createServer();
await new Promise(resolve => listener.listen(0,"127.0.0.1",resolve));
const port = listener.address().port;
await new Promise(resolve => listener.close(resolve));
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
  env:{...process.env,NODE_ENV:"production",NEXT_PUBLIC_DEMO_MODE:"false",FIXO_APP_URL:`http://127.0.0.1:${port}`,FIXO_INVITATIONS_ENABLED:"false"},stdio:["ignore","pipe","pipe"],windowsHide:true,
});
let output = "";
server.stdout.on("data",data => {output += data;});
server.stderr.on("data",data => {output += data;});
try {
  const origin = `http://127.0.0.1:${port}`;
  let ready = false;
  for(let attempt=0; attempt<80; attempt++) {
    try { await fetch(origin+"/login",{signal:AbortSignal.timeout(1000)});ready=true;break; } catch { /* waiting for server */ }
    if(server.exitCode !== null) break;
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  assert(ready,"Production server did not become ready");
  const forged = encodeURIComponent(JSON.stringify({id:"forged",name:"Forged",email:"forged@example.invalid",role:"superadmin"}));
  for(const path of ["/admin","/admin/usuarios","/admin/usuarios/auditoria","/cliente","/tecnico","/perfil"]) {
    const result=await fetch(origin+path,{redirect:"manual",headers:{cookie:`fixo_demo_session=${forged}`},signal:AbortSignal.timeout(10000)});
    assert.equal(result.status,307,`${path} must reject the forged session`);
    assert.equal(new URL(result.headers.get("location"),origin).pathname,"/login");
  }
  const emergency=await fetch(origin+"/urgencia");
  assert((await emergency.text()).includes("Atención de urgencias no disponible"));
  for(const [path,copy] of [["/recuperar-contrasena","Recupera tu acceso"],["/auth/update-password","El enlace no está disponible"],["/auth/callback?error=expired&next=https://evil.invalid","El enlace no está disponible"]]){
    const result=await fetch(origin+path);assert.equal(result.status,200);assert((await result.text()).includes(copy));
  }
  const callback=await fetch(origin+"/auth/callback?token_hash="+"a".repeat(64)+"&type=recovery");
  assert.equal(callback.status,200);assert(callback.headers.get("cache-control").includes("no-store"));
  assert.equal(callback.headers.get("referrer-policy"),"no-referrer");assert((await callback.text()).includes("Continuar de forma segura"));
  const forbidden=await fetch(origin+"/api/auth",{method:"POST",headers:{origin:"https://evil.invalid","Content-Type":"application/json"},body:JSON.stringify({action:"login",input:{}})});
  assert.equal(forbidden.status,403);
  console.log("PASS production HTTP: forged demo cookie rejected by six protected routes; Auth pages, invalid links, no-store/referrer policy and foreign-origin rejection verified without Auth writes.");
} catch(error) {
  console.error(error.message);
  // Runtime errors are summarized; raw server output may contain sensitive data.
  console.error(`Server exited: ${server.exitCode}; startup output length: ${output.length}`);
  process.exitCode=1;
} finally {
  server.kill();
  await new Promise(resolve=>{if(server.exitCode!==null)resolve();else server.once("exit",resolve);});
}
