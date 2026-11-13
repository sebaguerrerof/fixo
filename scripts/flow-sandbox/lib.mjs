// Shared helpers for the REMOTE Flow Sandbox run (runbook §9, phase C). Everything here is deliberately narrow:
//  * only the Fixo project ref below and the canonical site origin are accepted;
//  * only synthetic accounts whose e-mail ends in `.invalid` are ever created or touched, and only the UUIDs recorded in the MANIFEST;
//  * secrets (passwords, tokens) never go to the manifest (which is committed) — they live in a private file outside the repository.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

export const PROJECT_REF = 'rjzyqdhotcshvbdcrgon';
export const SITE = 'https://www.soyfixo.cl';
export const MANIFEST_PATH = resolve('docs/production/sprint-05-evidence/flow-sandbox-manifest.json');
export const SECRETS_PATH = process.env.FIXO_FLOW_SECRETS_FILE ?? join(tmpdir(), 'fixo-flow-sandbox-secrets.json');
const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

/** Reads .env.local WITHOUT printing anything; returns only the keys this tool needs. */
export async function loadEnv() {
  const text = await readFile(resolve('.env.local'), 'utf8'); const env = {};
  for (const line of text.split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(line); if (m) env[m[1]] = m[2].trim().replace(/^"|"$/g, ''); }
  const url = env.NEXT_PUBLIC_SUPABASE_URL, anon = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, service = env.SUPABASE_SERVICE_ROLE_KEY;
  assert.ok(url && anon && service, 'faltan variables de Supabase en .env.local');
  assert.equal(new URL(url).hostname, `${PROJECT_REF}.supabase.co`, 'el destino no es el proyecto Fixo autorizado');
  return { url, anon, service, workerSecret: env.FIXO_PAYMENTS_WORKER_SECRET };
}
export const serviceClient = env => createClient(env.url, env.service, opts);
export const anonClient = env => createClient(env.url, env.anon, opts);

/** Owner-level SQL against the remote project through the Supabase CLI (the only DB channel available; no DB password is used or stored). */
export function sql(statement) {
  const file = join(tmpdir(), `fixo-flow-${randomBytes(6).toString('hex')}.sql`);
  return writeFile(file, statement, 'utf8').then(() => {
    const r = spawnSync(`npx --yes supabase@3.1.0 db query --remote=${PROJECT_REF} --yes --file "${file}"`, { shell: true, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
    const out = (r.stdout ?? '') + (r.stderr ?? '');
    const found = /^\{/m.exec(out); assert.ok(found, 'sin respuesta JSON de la CLI: ' + out.slice(0, 300));
    const start = found.index, end = out.indexOf('\n}', start);
    let json; try { json = JSON.parse(out.slice(start, end + 2)); } catch { throw new Error('respuesta ilegible: ' + out.slice(start, start + 300)); }
    if (json._tag === 'Error') throw new Error('SQL falló: ' + JSON.stringify(json.error).slice(0, 400));
    return json.rows ?? [];
  });
}
export const lit = v => v === null ? 'null' : `'${String(v).replaceAll("'", "''")}'`;

export async function readManifest() { return existsSync(MANIFEST_PATH) ? JSON.parse(await readFile(MANIFEST_PATH, 'utf8')) : null; }
export async function writeManifest(m) { await mkdir(dirname(MANIFEST_PATH), { recursive: true }); await writeFile(MANIFEST_PATH, JSON.stringify(m, null, 2) + '\n', 'utf8'); }
/** Exclusive lock over the manifest (O_EXCL lock file, fails fast). A stale lock after a crash must be removed by hand (the message says which file). */
export async function lockManifest() {
  const path = MANIFEST_PATH + '.lock';
  await mkdir(dirname(path), { recursive: true });
  try { await writeFile(path, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }), { flag: 'wx' }); }
  catch (error) { if (error?.code === 'EEXIST') throw new Error('el manifiesto está bloqueado por otra ejecución (si quedó tras una caída, revise y borre ' + path + ')'); throw error; }
  return async () => { await rm(path, { force: true }); };
}
export async function readSecrets() { return existsSync(SECRETS_PATH) ? JSON.parse(await readFile(SECRETS_PATH, 'utf8')) : {}; }
export async function writeSecrets(s) { await writeFile(SECRETS_PATH, JSON.stringify(s), { encoding: 'utf8', mode: 0o600 }); }
export const stamp = () => new Date().toISOString();

/** Signed-in client for one of the run's synthetic accounts (password from the private secrets file). */
export async function actorClient(env, secrets, label) {
  const a = secrets.accounts?.[label]; assert.ok(a, 'cuenta desconocida: ' + label);
  assert.ok(a.email.endsWith('.invalid'), 'sólo cuentas sintéticas .invalid');
  const client = anonClient(env); const r = await client.auth.signInWithPassword({ email: a.email, password: a.password }); assert.equal(r.error, null, 'login ' + label);
  return { id: a.id, email: a.email, client };
}
export async function rpc(actor, name, args) { const r = await actor.client.rpc(name, args); assert.equal(r.error, null, `${name}: ${r.error?.message}`); return r.data; }
