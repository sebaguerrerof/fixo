// Takes the privilege snapshot of a Supabase project (READ-ONLY transaction) and writes it as JSON, ready to be added to the encrypted backup.
//   node scripts/backup/privilege-snapshot.mjs --project <ref> --out <file.json>
// Refuses to overwrite an existing file. Prints only counts. The snapshot contains object names and role privileges: no data, but keep it with the backup.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SNAPSHOT_SQL, buildSnapshotDoc } from './privileges-lib.mjs';

const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const project = arg('--project'), out = arg('--out');
if (!/^[a-z0-9]{20}$/.test(project ?? '') || !out) { console.error('uso: node scripts/backup/privilege-snapshot.mjs --project <ref de 20 caracteres> --out <archivo.json>'); process.exit(2); }
if (existsSync(out)) { console.error('el archivo de salida ya existe; no se sobrescribe: ' + out); process.exit(2); }

const dir = await mkdtemp(join(tmpdir(), 'fixo-privs-'));
try {
  const file = join(dir, 'snapshot.sql'); await writeFile(file, SNAPSHOT_SQL);
  const run = spawnSync(`npx --yes supabase@3.1.0 db query --remote=${project} --read-only --file "${file}"`, { encoding: 'utf8', shell: true, env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
  const text = run.stdout ?? '';
  if (run.status !== 0 || !text.includes('"rows"')) { console.error('la consulta falló (código ' + run.status + '): ' + (run.stderr || text).slice(0, 300)); process.exit(1); }
  const rows = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)).rows;
  const doc = buildSnapshotDoc(rows, { project });                  // validates metadata, per-kind counts and the digest of the rows
  await writeFile(out, JSON.stringify(doc, null, 2) + '\n', { flag: 'wx' });
  const byKind = Object.fromEntries(['sch', 'fn', 'rel', 'seq'].map(k => [k, rows.filter(r => r.k === k).length]));
  console.log(JSON.stringify({ out, objects: rows.length, byKind, digest: doc.digest }));
} finally { await rm(dir, { recursive: true, force: true }); }
