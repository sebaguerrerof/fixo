import assert from 'node:assert/strict';import{randomUUID}from'node:crypto';import{readFile,writeFile}from'node:fs/promises';import{createClient}from'@supabase/supabase-js';
const ref='rjzyqdhotcshvbdcrgon',run=process.env.FIXO_SPRINT03_RUN;assert.equal(process.env.FIXO_SPRINT03_AUTHORIZED,ref);assert.match(run??'',/^[0-9a-f-]{36}$/);
const file='.audit-backups/sprint03-native/'+run+'/manifest.json',m=JSON.parse(await readFile(file,'utf8'));assert.equal(m.project,ref);
const env={};for(const line of(await readFile('.env.local','utf8')).split(/\r?\n/)){const x=line.match(/^([A-Z_][A-Z_0-9]*)\s*=\s*(.*)$/);if(x)env[x[1]]=x[2].replace(/^(['"])(.*)\1$/,'$2');}
assert.equal(new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname,ref+'.supabase.co');
const clients={};for(const label of['customerA','technicianA','administrator']){const a=m.actors.find(a=>a.label===label),c=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});assert.equal((await c.auth.signInWithPassword({email:a.email,password:a.password})).error,null);clients[label]=c;}
async function rpc(label,name,args={}){const r=await clients[label].rpc(name,args);assert.equal(r.error,null);return r.data;}
let app=await rpc('technicianA','professional_application');
const payload={city:'Ñuñoa',coverage:['Ñuñoa'],headline:'Servicios sintéticos de gasfitería',bio:'Experiencia sintética para probar el marketplace y su autorización de oportunidades.',categories:['gasfiteria','jardineria'],primaryCategory:'gasfiteria',specialties:['Prueba sintética'],years:5,price:25000,availability:'Mañanas',portfolio:[]};
await rpc('technicianA','save_professional_application',{payload,expected_revision:app.revision,operation_id:randomUUID()});app=await rpc('technicianA','professional_application');assert.equal(app.published,false);
await rpc('technicianA','submit_professional_application',{expected_revision:app.revision,consent:true,operation_id:randomUUID()});app=await rpc('technicianA','professional_application');
await rpc('administrator','admin_decide_professional_application',{target:m.actors.find(a=>a.label==='technicianA').id,decision:'approved',expected_revision:app.revision,reason:'Synthetic category scope regression',operation_id:randomUUID()});
const r=await rpc('customerA','marketplace_create_request',{operation_id:randomUUID(),payload:{title:'Rubro secundario sintético',categoryId:'jardineria',description:'Solicitud sintética para comprobar alcance de revisión profesional.',locationLabel:'Ñuñoa'}});m.requests.push(r.id);await writeFile(file,JSON.stringify(m,null,2));
assert.equal(await rpc('technicianA','marketplace_request_detail',{request_id:r.id}),null);
assert.ok((await clients.technicianA.rpc('marketplace_save_quote',{request_id:r.id,operation_id:randomUUID(),payload:{}})).error);
const primary=await rpc('customerA','marketplace_create_request',{operation_id:randomUUID(),payload:{title:'Rubro principal sintético',categoryId:'gasfiteria',description:'Solicitud sintética para comprobar alcance de revisión profesional.',locationLabel:'Ñuñoa'}});m.requests.push(primary.id);await writeFile(file,JSON.stringify(m,null,2));
assert.ok(await rpc('technicianA','marketplace_request_detail',{request_id:primary.id}));
m.categoryScope={status:'PASS integración',checks:['profile edit invalidates approval until reviewed again','secondary category detail and quote denied','primary reviewed category remains eligible']};await writeFile(file,JSON.stringify(m,null,2));console.log(JSON.stringify(m.categoryScope));
