// Generates the SQL that reconciles (or only verifies) the privileges of a RESTORED database against a snapshot. It never connects to anything:
// review the generated file and run it yourself against the restored target, as its owner role.
//   node scripts/backup/privilege-reconcile.mjs --snapshot <file.json> --out <file.sql> [--verify-only] [--allow-extra <list.json>]
// `--allow-extra` is a JSON list of "<kind> <identity>" entries (e.g. "fn public.managed_fn(x integer)") for objects that MAY exist in the target without existing in the
// snapshot (managed objects). Any other extra object in public/private makes the generated script fail.
// The generated script runs in one transaction and RAISES (rolling back) if an object is missing or any privilege still differs after reconciling.
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { buildReconcileSql } from './privileges-lib.mjs';

const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const snapshot = arg('--snapshot'), out = arg('--out'), verifyOnly = process.argv.includes('--verify-only'), allowFile = arg('--allow-extra');
if (!snapshot || !out) { console.error('uso: node scripts/backup/privilege-reconcile.mjs --snapshot <instantánea.json> --out <archivo.sql> [--verify-only] [--allow-extra <lista.json>]'); process.exit(2); }
if (existsSync(out)) { console.error('el archivo de salida ya existe; no se sobrescribe: ' + out); process.exit(2); }
const allowExtra = allowFile ? JSON.parse(await readFile(allowFile, 'utf8')) : [];
const sql = buildReconcileSql(JSON.parse(await readFile(snapshot, 'utf8')), { verifyOnly, allowExtra });
await writeFile(out, sql, { flag: 'wx' });
console.log(JSON.stringify({ out, mode: verifyOnly ? 'verify-only' : 'reconcile+verify', bytes: sql.length }));
