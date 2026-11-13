// Privilege snapshot and reconciliation for backup/restore (BACKUP_RESTORE_RUNBOOK §3, §10 and §11).
// WHY: `pg_dump` emits REVOKE ... FROM PUBLIC and GRANT ... to the final roles, but it assumes the source's default privileges. A target with different
// default privileges (every Supabase project has `pg_default_acl` entries for anon/authenticated/service_role) ends up MORE permissive than the source:
// the 2026-11-13 rehearsal restored 79/130 functions and 11/43 relations with extra grants (e.g. anon could execute payment_prepare).
// The snapshot records the exact privileges (including WITH GRANT OPTION) of the four roles that matter, per object. The reconcile script revokes and
// re-grants exactly that and RAISES (rolling everything back) if the target differs in ANY direction: a snapshot object that is missing, an EXTRA object
// in the target that the source never had, or any privilege or grant option that still differs. A wider-than-production target can never be declared restored.
import { createHash } from 'node:crypto';

export const SNAPSHOT_VERSION = 2;
export const SNAPSHOT_KIND = 'fixo-privilege-snapshot';
export const SNAPSHOT_SCHEMAS = ['public', 'private'];
export const SNAPSHOT_ROLES = ['PUBLIC', 'anon', 'authenticated', 'service_role'];

const GRANTEE = "(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end)";
// One token per (role, privilege): `role:PRIV` or `role:PRIV:GRANT` when it carries WITH GRANT OPTION (bool_or across grantors).
const aclOf = (acl, def, owner) => `coalesce((select string_agg(x.g || ':' || x.p || case when x.gr then ':GRANT' else '' end, ',' order by x.g, x.p) from (select ${GRANTEE} as g, a.privilege_type as p, bool_or(a.is_grantable) as gr from aclexplode(coalesce(${acl}, acldefault('${def}', ${owner}))) a where ${GRANTEE} in ('PUBLIC','anon','authenticated','service_role') group by 1, 2) x), '')`;
const schemas = SNAPSHOT_SCHEMAS.map(s => `'${s}'`).join(',');
// Objects that belong to an extension are managed by it (restored by CREATE EXTENSION): excluded on BOTH sides, so they can neither be "missing" nor "extra".
const notExtension = (cls, alias) => `and not exists (select 1 from pg_depend d where d.classid = '${cls}'::regclass and d.objid = ${alias}.oid and d.deptype = 'e')`;

/** One row per object (kind, object identity, privileges for the four roles). Every column is cast to text: a `name` column in a UNION is typed `name` and silently
 *  TRUNCATES long function identities at 63 bytes. Function identities also depend on the session search_path, so every session that runs this query (the snapshot and the
 *  verification) first sets `search_path = pg_catalog`: all non-catalog types are then schema-qualified, identically everywhere. */
export const SNAPSHOT_QUERY = `select 'sch'::text as k, n.nspname::text as o, ${aclOf('n.nspacl', 'n', 'n.nspowner')} as acl from pg_namespace n where n.nspname in (${schemas})
union all select 'fn', (n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')')::text, ${aclOf('p.proacl', 'f', 'p.proowner')} from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in (${schemas}) ${notExtension('pg_proc', 'p')}
union all select 'rel', (n.nspname || '.' || c.relname)::text, ${aclOf('c.relacl', 'r', 'c.relowner')} from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname in (${schemas}) and c.relkind in ('r','v','m','p') ${notExtension('pg_class', 'c')}
union all select 'seq', (n.nspname || '.' || c.relname)::text, ${aclOf('c.relacl', 's', 'c.relowner')} from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname in (${schemas}) and c.relkind = 'S' ${notExtension('pg_class', 'c')}
order by 1, 2`;
/** The same query preceded by the search_path fix, as a standalone script for `supabase db query`. */
export const SNAPSHOT_SQL = `select set_config('search_path', 'pg_catalog', false);\n${SNAPSHOT_QUERY}`;

const lit = value => `'${String(value).replaceAll("'", "''")}'`;
const KINDS = { sch: 'SCHEMA', fn: 'FUNCTION', rel: 'TABLE', seq: 'SEQUENCE' };
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const PROJECT = /^[a-z0-9]{20}$/;
const TOKEN = /^(PUBLIC|anon|authenticated|service_role):([A-Z]+)(:GRANT)?$/;
const CONTROL = new RegExp('[\u0000-\u001f\u007f\u2028\u2029]');
const sameList = (a, b) => Array.isArray(a) && a.length === b.length && a.every((v, i) => v === b[i]);

const canonicalRows = rows => rows.map(r => [r.k, r.o, r.acl]).sort((a, b) => { const x = a[0] + '\u0000' + a[1], y = b[0] + '\u0000' + b[1]; return x < y ? -1 : x > y ? 1 : 0; });
const digestOf = rows => createHash('sha256').update(JSON.stringify(canonicalRows(rows))).digest('hex');
const countsOf = rows => Object.fromEntries(Object.keys(KINDS).map(k => [k, rows.filter(r => r.k === k).length]));

/** Builds the snapshot document (what `privilege-snapshot.mjs` writes): metadata, per-kind counts and a digest of the rows, so a trimmed file is rejected. */
export function buildSnapshotDoc(rows, { project, takenAt = new Date().toISOString() }) {
  const doc = { kind: SNAPSHOT_KIND, version: SNAPSHOT_VERSION, takenAt, project, schemas: [...SNAPSHOT_SCHEMAS], roles: [...SNAPSHOT_ROLES], counts: countsOf(rows), digest: digestOf(rows), rows };
  parseSnapshot(doc);
  return doc;
}

/** Strictly validates a snapshot document and returns its rows. Throws on anything unexpected: a corrupt, incomplete or tampered snapshot must never be applied. */
export function parseSnapshot(doc) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw new Error('instantánea inválida: no es un objeto');
  if (doc.kind !== SNAPSHOT_KIND) throw new Error('instantánea inválida: tipo desconocido');
  if (doc.version !== SNAPSHOT_VERSION) throw new Error(`instantánea inválida: versión ${String(doc.version)} no soportada (se espera ${SNAPSHOT_VERSION}; las anteriores no registran WITH GRANT OPTION ni excluyen extensiones)`);
  if (typeof doc.project !== 'string' || !PROJECT.test(doc.project)) throw new Error('instantánea inválida: proyecto');
  if (typeof doc.takenAt !== 'string' || !ISO.test(doc.takenAt) || Number.isNaN(Date.parse(doc.takenAt))) throw new Error('instantánea inválida: fecha');
  if (!sameList(doc.schemas, SNAPSHOT_SCHEMAS)) throw new Error('instantánea inválida: esquemas');
  if (!sameList(doc.roles, SNAPSHOT_ROLES)) throw new Error('instantánea inválida: roles');
  if (!Array.isArray(doc.rows) || doc.rows.length === 0) throw new Error('instantánea inválida: sin filas');
  const seen = new Set();
  for (const row of doc.rows) {
    if (!row || typeof row !== 'object' || !KINDS[row.k] || typeof row.o !== 'string' || !row.o || row.o.length > 600 || CONTROL.test(row.o) || typeof row.acl !== 'string') throw new Error('instantánea inválida: fila malformada');
    const key = `${row.k} ${row.o}`; if (seen.has(key)) throw new Error('instantánea inválida: objeto repetido ' + key); seen.add(key);
    const tokens = row.acl.split(',').filter(Boolean);
    if (new Set(tokens.map(t => t.split(':').slice(0, 2).join(':'))).size !== tokens.length) throw new Error('instantánea inválida: privilegio repetido en ' + key);
    for (const token of tokens) if (!TOKEN.test(token)) throw new Error('instantánea inválida: privilegio ' + token);
  }
  for (const schema of SNAPSHOT_SCHEMAS) if (!seen.has(`sch ${schema}`)) throw new Error('instantánea incompleta: falta el esquema ' + schema);
  const counts = countsOf(doc.rows);
  if (!doc.counts || Object.keys(KINDS).some(k => doc.counts[k] !== counts[k])) throw new Error('instantánea incompleta: los conteos no coinciden con las filas');
  if (doc.digest !== digestOf(doc.rows)) throw new Error('instantánea alterada o incompleta: el digest no coincide con las filas');
  return doc.rows;
}

/** Validates the explicit exceptions for EXTRA objects in the target (managed objects). Each entry is `<kind> <identity>` exactly as it appears in a snapshot. */
export function parseAllowExtra(list) {
  if (list === undefined) return [];
  if (!Array.isArray(list)) throw new Error('allow-extra inválido: se espera una lista');
  const seen = new Set();
  for (const entry of list) {
    const m = typeof entry === 'string' ? /^(sch|fn|rel|seq) (.+)$/.exec(entry) : null;
    if (!m || CONTROL.test(entry) || entry.length > 600) throw new Error('allow-extra inválido: ' + JSON.stringify(entry));
    if (seen.has(entry)) throw new Error('allow-extra inválido: repetido ' + entry); seen.add(entry);
  }
  return [...seen];
}

// The comment line contains validated metadata only, and is forced to a single line anyway: nothing in it can start a statement.
const oneLine = value => String(value).replace(/[^\x20-\x7e]/g, '?');

/**
 * SQL for the restored target. `verifyOnly` skips the revoke/grant and only checks. The script runs in ONE transaction and raises (rolling back everything) when:
 * an object of the snapshot is missing in the target, the target has an object in the audited schemas that is NOT in the snapshot (unless listed in `allowExtra`),
 * or, after reconciling, any privilege or grant option of the four roles differs from the snapshot. DDL is built from identifiers resolved in the target's catalog
 * (by OID, quoted by PostgreSQL), never from the text of the snapshot.
 */
export function buildReconcileSql(doc, { verifyOnly = false, allowExtra = [] } = {}) {
  const rows = parseSnapshot(doc);
  const allowed = parseAllowExtra(allowExtra);
  const objects = rows.map(r => `(${lit(r.k)},${lit(r.o)})`).join(',\n  ');
  const grants = rows.flatMap(r => r.acl.split(',').filter(Boolean).map(t => { const [role, priv, opt] = t.split(':'); return `(${lit(r.k)},${lit(r.o)},${lit(role)},${lit(priv)},${opt === 'GRANT'})`; }));
  return `-- Generated by scripts/backup/privilege-reconcile.mjs (${verifyOnly ? 'VERIFY ONLY' : 'RECONCILE + VERIFY'}); snapshot taken ${oneLine(doc.takenAt)} from ${oneLine(doc.project)}. Run as the object owner (postgres/supabase_admin).
begin;
set local search_path = pg_catalog;
create temp table snap_objects(k text, o text) on commit drop;
insert into snap_objects values
  ${objects};
create temp table snap_grants(k text, o text, role text, priv text, grantable boolean) on commit drop;
${grants.length ? `insert into snap_grants values\n  ${grants.join(',\n  ')};` : '-- (no privileges for the four roles in the snapshot)'}
create temp table allow_extra(k text, o text) on commit drop;
${allowed.length ? `insert into allow_extra values\n  ${allowed.map(e => `(${lit(e.slice(0, e.indexOf(' ')))},${lit(e.slice(e.indexOf(' ') + 1))})`).join(',\n  ')};` : '-- (no explicit exceptions for extra objects)'}
create temp table cur_inventory on commit drop as ${SNAPSHOT_QUERY};
-- identifiers are resolved from the TARGET catalog (oid -> regprocedure/regclass, quoted by PostgreSQL); NULL means the snapshot object does not exist in the target
create temp table snap_resolved on commit drop as
select s.k, s.o,
  case s.k when 'sch' then quote_ident(n.nspname) when 'fn' then p.oid::regprocedure::text else c.oid::regclass::text end as ident,
  case s.k when 'sch' then 'SCHEMA' when 'fn' then 'FUNCTION' when 'seq' then 'SEQUENCE' else 'TABLE' end as kw
from snap_objects s
left join pg_namespace n on s.k = 'sch' and n.nspname = s.o
left join (pg_proc p join pg_namespace pn on pn.oid = p.pronamespace) on s.k = 'fn' and pn.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' = s.o
left join (pg_class c join pg_namespace cn on cn.oid = c.relnamespace) on s.k in ('rel','seq') and cn.nspname || '.' || c.relname = s.o and c.relkind in ('r','v','m','p','S') and (c.relkind = 'S') = (s.k = 'seq');
do $$
declare r record; g record; missing text[]; extra text[]; begin
  select coalesce(array_agg(k || ' ' || o order by k, o), '{}') into missing from snap_resolved where ident is null;
  if cardinality(missing) > 0 then raise exception 'objetos de la instantánea ausentes en el destino (% en total), p. ej.: %', cardinality(missing), missing[1:5]; end if;
  select coalesce(array_agg(c.k || ' ' || c.o order by c.k, c.o), '{}') into extra from cur_inventory c
   where not exists (select 1 from snap_objects s where s.k = c.k and s.o = c.o) and not exists (select 1 from allow_extra e where e.k = c.k and e.o = c.o);
  if cardinality(extra) > 0 then raise exception 'objetos INESPERADOS en el destino, ausentes en el origen (% en total), p. ej.: %. Revíselos; si son administrados, declárelos explícitamente con --allow-extra', cardinality(extra), extra[1:5]; end if;
${verifyOnly ? '  null;' : `  for r in select * from snap_resolved loop
    execute format('revoke all on %s %s from public, anon, authenticated, service_role', r.kw, r.ident);
    for g in select role, priv, grantable from snap_grants where k = r.k and o = r.o loop
      execute format('grant %s on %s %s to %s%s', g.priv, r.kw, r.ident, case g.role when 'PUBLIC' then 'public' else quote_ident(g.role) end, case when g.grantable then ' with grant option' else '' end);
    end loop;
  end loop;`}
end $$;
-- verification: current privileges (including grant options) of the four roles must equal the snapshot, object by object
create temp table cur_acl on commit drop as ${SNAPSHOT_QUERY};
do $$
declare diff text[]; begin
  select coalesce(array_agg(x.k || ' ' || x.o order by x.k, x.o), '{}') into diff from (
    select s.k, s.o from snap_objects s left join cur_acl c on c.k = s.k and c.o = s.o
    where coalesce(c.acl, '') is distinct from coalesce((select string_agg(g.role || ':' || g.priv || case when g.grantable then ':GRANT' else '' end, ',' order by g.role, g.priv) from snap_grants g where g.k = s.k and g.o = s.o), '')
  ) x;
  if cardinality(diff) > 0 then raise exception 'privilegios distintos de la instantánea en % objetos, p. ej.: %', cardinality(diff), diff[1:5]; end if;
  raise notice 'OK: % objetos con privilegios idénticos a la instantánea (incluida la opción de delegación)', (select count(*) from snap_objects);
end $$;
commit;
`;
}
