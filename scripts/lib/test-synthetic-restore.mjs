// Application-only recovery proof. The Auth/Storage schemas are SQL fixtures, not hosted services.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const quote=name=>'"'+name.replaceAll('"','""')+'"';
export async function testSyntheticRestore({admin,server,bootstrapSql,root,actors,jobId}){
 const database='restore_s04_'+randomUUID().replaceAll('-','');assert.match(database,/^restore_s04_[0-9a-f]{32}$/);
 const tables=(await admin.query("select n.nspname schema,c.relname name from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname=any(array['public','private','auth','storage'])order by 1,2")).rows,backup=[];
 for(const t of tables){const table=quote(t.schema)+'.'+quote(t.name),r=(await admin.query(`select coalesce(jsonb_agg(to_jsonb(t)order by to_jsonb(t)::text),'[]') rows,md5(coalesce(string_agg(to_jsonb(t)::text,E'\n'order by to_jsonb(t)::text),'')) digest from ${table} t`)).rows[0];backup.push({...t,...r});}
 await writeFile(resolve(root,'synthetic-data-export.json'),JSON.stringify(backup));await admin.query(`create database ${quote(database)}`);
 const restored=server.getPgClient(database,'127.0.0.1');await restored.connect();
 try{
  await restored.query(bootstrapSql.replace(/create role [^;]+;/g,''));
  for(const f of(await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await restored.query(await readFile(resolve('supabase/migrations',f),'utf8'));
  // The destination was created above in this owned synthetic cluster. Never truncates the source or Fixo.
  await restored.query('begin');await restored.query('set local session_replication_role=replica');await restored.query('truncate '+tables.map(t=>quote(t.schema)+'.'+quote(t.name)).join(',')+' cascade');
  for(const t of backup){const table=quote(t.schema)+'.'+quote(t.name),columns=(await restored.query("select a.attname from pg_attribute a where a.attrelid=$1::regclass and a.attnum>0 and not a.attisdropped and a.attgenerated=''order by a.attnum",[table])).rows.map(a=>quote(a.attname)).join(',');if(t.rows.length)await restored.query(`insert into ${table}(${columns})select ${columns}from jsonb_populate_recordset(null::${table},$1::jsonb)`,[JSON.stringify(t.rows)]);}
  await restored.query('commit');
  for(const t of backup){const r=(await restored.query(`select md5(coalesce(string_agg(to_jsonb(t)::text,E'\n'order by to_jsonb(t)::text),'')) digest from ${quote(t.schema)}.${quote(t.name)} t`)).rows[0];assert.equal(r.digest,t.digest,t.schema+'.'+t.name);}
  const fks=(await restored.query("select conrelid::regclass::text child,confrelid::regclass::text parent,array(select attname::text from unnest(conkey)with ordinality k(num,ord)join pg_attribute a on a.attrelid=conrelid and a.attnum=k.num order by ord) child_keys,array(select attname::text from unnest(confkey)with ordinality k(num,ord)join pg_attribute a on a.attrelid=confrelid and a.attnum=k.num order by ord) parent_keys from pg_constraint where contype='f'and connamespace in(select oid from pg_namespace where nspname=any(array['public','private','auth','storage']))")).rows;
  for(const fk of fks){const present=fk.child_keys.map(k=>'c.'+quote(k)+' is not null').join(' and '),match=fk.child_keys.map((k,i)=>'c.'+quote(k)+'=p.'+quote(fk.parent_keys[i])).join(' and ');assert.equal((await restored.query(`select count(*)::int n from ${fk.child} c where ${present} and not exists(select 1 from ${fk.parent} p where ${match})`)).rows[0].n,0,'restored FK '+fk.child);}
  await restored.query('set role authenticated');const claims=(await actors.customerB.client.query("select current_setting('request.jwt.claims') claims")).rows[0].claims;await restored.query("select set_config('request.jwt.claims',$1,false)",[claims]);assert.equal((await restored.query('select public.job_detail($1) value',[jobId])).rows[0].value,null);
  const ownClaims=(await actors.customerA.client.query("select current_setting('request.jwt.claims') claims")).rows[0].claims;await restored.query("select set_config('request.jwt.claims',$1,false)",[ownClaims]);assert.equal((await restored.query('select public.job_detail($1) value',[jobId])).rows[0].value.job.id,jobId);
  await writeFile(resolve(root,'restore-result.json'),JSON.stringify({status:'PASS local',scope:'synthetic application data, canonical migrations, SQL Auth/Storage fixtures only',tables:backup.length,rows:backup.reduce((n,t)=>n+t.rows.length,0),foreignKeys:fks.length,digestsMatch:true,rlsRechecked:true,hostedAuthRestore:false,storageBlobs:false,database},null,2));
 }finally{await restored.end();}
}
