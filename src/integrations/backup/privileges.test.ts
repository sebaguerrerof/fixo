import { describe, it, expect } from "vitest";
import { SNAPSHOT_QUERY, SNAPSHOT_SQL, buildReconcileSql, buildSnapshotDoc, parseAllowExtra, parseSnapshot } from "../../../scripts/backup/privileges-lib.mjs";

const PROJECT = "abcdefghij0123456789";
const rows = [
  { k: "sch" as const, o: "public", acl: "anon:USAGE,authenticated:USAGE,service_role:USAGE" },
  { k: "sch" as const, o: "private", acl: "" },
  { k: "fn" as const, o: "public.payment_prepare(target_job uuid, consent boolean)", acl: "authenticated:EXECUTE" },
  { k: "rel" as const, o: "public.jobs", acl: "authenticated:SELECT:GRANT,service_role:DELETE,service_role:SELECT" },
  { k: "seq" as const, o: "public.some_seq", acl: "" },
];
const doc = () => buildSnapshotDoc(rows, { project: PROJECT, takenAt: "2026-11-13T12:00:00.000Z" });
const mutate = (fn: (d: ReturnType<typeof doc>) => void) => { const d = structuredClone(doc()); fn(d); return d; };

describe("privilege snapshot for backup/restore", () => {
  it("the snapshot query is search_path independent, cannot truncate identities, records grant options and ignores extension members", () => {
    expect(SNAPSHOT_SQL.startsWith("select set_config('search_path', 'pg_catalog', false);")).toBe(true);
    expect(SNAPSHOT_QUERY).toContain("n.nspname::text as o");           // a `name` column would type the whole UNION as name and cut identities at 63 bytes
    expect(SNAPSHOT_QUERY).toContain("'sch'::text as k");
    expect(SNAPSHOT_QUERY).toContain("bool_or(a.is_grantable)");        // WITH GRANT OPTION is part of the snapshot
    expect(SNAPSHOT_QUERY).toContain(":GRANT");
    expect(SNAPSHOT_QUERY.match(/deptype = 'e'/g)).toHaveLength(3);     // functions, relations and sequences owned by an extension are managed by it
    expect(SNAPSHOT_QUERY).not.toContain("set_config");
  });

  it("builds a self-describing document and accepts it back", () => {
    const d = doc();
    expect(d).toMatchObject({ kind: "fixo-privilege-snapshot", version: 2, project: PROJECT, schemas: ["public", "private"], counts: { sch: 2, fn: 1, rel: 1, seq: 1 } });
    expect(d.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(parseSnapshot(d)).toHaveLength(5);
    expect(doc().digest).toBe(d.digest);                                 // deterministic
  });

  it("rejects corrupt, trimmed, altered or old-format snapshots before any SQL is produced", () => {
    expect(() => parseSnapshot(null)).toThrow(/inválida/);
    expect(() => parseSnapshot({ ...doc(), kind: "otra-cosa" })).toThrow(/tipo desconocido/);
    expect(() => parseSnapshot(mutate(d => { d.version = 1; }))).toThrow(/versión 1 no soportada/);
    expect(() => parseSnapshot(mutate(d => { d.schemas = ["public"]; }))).toThrow(/esquemas/);
    expect(() => parseSnapshot(mutate(d => { d.roles = ["anon"]; }))).toThrow(/roles/);
    expect(() => parseSnapshot(mutate(d => { d.rows = []; }))).toThrow(/sin filas/);
    expect(() => parseSnapshot(mutate(d => { d.rows = d.rows.slice(0, 1); }))).toThrow(/incompleta/);                  // trimmed to a single row
    expect(() => parseSnapshot(mutate(d => { d.rows = d.rows.filter(r => r.k !== "fn"); }))).toThrow(/conteos/);        // old counts kept: still caught
    expect(() => parseSnapshot(mutate(d => { d.rows = d.rows.filter(r => r.k !== "fn"); d.counts.fn = 0; }))).toThrow(/digest/);   // counts rewritten too: the digest catches it
    expect(() => parseSnapshot(mutate(d => { d.rows[3].acl = "authenticated:SELECT,anon:SELECT"; }))).toThrow(/digest/);
    expect(() => parseSnapshot(mutate(d => { d.rows = d.rows.filter(r => r.o !== "private"); d.counts.sch = 1; }))).toThrow(/falta el esquema private/);
    expect(() => buildSnapshotDoc([{ k: "fn", o: "public.f()", acl: "anon:EXECUTE" }], { project: PROJECT })).toThrow(/incompleta/);
  });

  it("validates every row and every privilege token (only the four roles, upper-case privileges, optional :GRANT)", () => {
    const bad = (row: Record<string, unknown>) => () => buildSnapshotDoc([...rows, row as never], { project: PROJECT });
    expect(bad({ k: "zzz", o: "x", acl: "" })).toThrow(/malformada/);
    expect(bad({ k: "fn", o: "", acl: "" })).toThrow(/malformada/);
    expect(bad({ k: "fn", o: "a\nb", acl: "" })).toThrow(/malformada/);
    expect(bad({ k: "fn", o: "a", acl: "root:EXECUTE" })).toThrow(/privilegio/);
    expect(bad({ k: "fn", o: "a", acl: "anon:execute;drop" })).toThrow(/privilegio/);
    expect(bad({ k: "fn", o: "a", acl: "anon:EXECUTE:ADMIN" })).toThrow(/privilegio/);
    expect(bad({ k: "fn", o: "a", acl: "anon:EXECUTE,anon:EXECUTE:GRANT" })).toThrow(/repetido/);
    expect(bad({ k: "sch", o: "public", acl: "" })).toThrow(/repetido/);
  });

  it("metadata cannot smuggle SQL outside the transaction, in any mode", () => {
    for (const field of ["project", "takenAt", "kind"] as const) {
      const bad = mutate(d => { const m = d as unknown as Record<string, unknown>; m[field] = String(m[field]) + "\nselect 123;"; });
      expect(() => buildReconcileSql(bad), field).toThrow(/inválida/);
      expect(() => buildReconcileSql(bad, { verifyOnly: true }), field).toThrow(/inválida/);
    }
    for (const value of ["abc\r\nselect 1", "abcdefghij0123456789;--", "ABCDEFGHIJ0123456789", "x"]) expect(() => buildReconcileSql(mutate(d => { d.project = value; }))).toThrow(/proyecto/);
    for (const value of ["2026-11-13", "2026-11-13T12:00:00Z\nselect 1", "ayer", "2026-13-45T99:99:99Z"]) expect(() => buildReconcileSql(mutate(d => { d.takenAt = value; }))).toThrow(/fecha/);
    const sql = buildReconcileSql(doc());
    const beforeBegin = sql.slice(0, sql.indexOf("begin;"));
    expect(beforeBegin.trim().split("\n")).toHaveLength(1);              // only the single comment line precedes the transaction
    expect(beforeBegin.startsWith("-- Generated by")).toBe(true);
  });

  it("the reconcile script compares both directions, preserves grant options and builds DDL from the target catalog", () => {
    const sql = buildReconcileSql(doc());
    expect(sql).toMatch(/RECONCILE \+ VERIFY/);
    expect(sql).toContain("begin;\nset local search_path = pg_catalog;");
    expect(sql).toContain("objetos INESPERADOS en el destino");          // extra objects
    expect(sql).toContain("objetos de la instantánea ausentes");          // missing objects
    expect(sql).toContain("privilegios distintos de la instantánea");     // differing privileges / grant options
    expect(sql).toContain("('rel','public.jobs','authenticated','SELECT',true)");
    expect(sql).toContain("('rel','public.jobs','service_role','DELETE',false)");
    expect(sql).toContain("with grant option");
    expect(sql).toContain("p.oid::regprocedure::text");                   // identifiers come from the catalog, quoted by PostgreSQL
    expect(sql).toContain("c.oid::regclass::text");
    expect(sql).not.toMatch(/format\('revoke all on %s %s from[^)]*\)\s*,\s*r\.kw\s*,\s*r\.o\b/);   // never the snapshot text
    expect(sql.trimEnd().endsWith("commit;")).toBe(true);
  });

  it("verify-only never changes a privilege but still checks both directions", () => {
    const sql = buildReconcileSql(doc(), { verifyOnly: true });
    expect(sql).toContain("VERIFY ONLY");
    expect(sql).not.toMatch(/execute format\('(revoke|grant)/);
    expect(sql).toContain("objetos INESPERADOS");
    expect(sql).toContain("privilegios distintos");
  });

  it("explicit exceptions for extra objects are validated and carried into the script", () => {
    expect(parseAllowExtra(undefined)).toEqual([]);
    expect(parseAllowExtra(["fn public.managed(x integer)", "rel private.shadow"])).toHaveLength(2);
    for (const bad of ["nope", ["fn"], ["zzz public.x"], ["fn public.x\nselect 1"], ["rel a", "rel a"], [1]]) expect(() => parseAllowExtra(bad as never)).toThrow(/allow-extra/);
    expect(() => parseAllowExtra("rel private.x" as never)).toThrow(/lista/);
    const sql = buildReconcileSql(doc(), { allowExtra: ["rel private.shadow"] });
    expect(sql).toContain("('rel','private.shadow')");
    expect(buildReconcileSql(doc())).toContain("no explicit exceptions");
  });

  it("escapes quotes in object names (no SQL injection through a snapshot)", () => {
    const d = buildSnapshotDoc([...rows, { k: "rel", o: "public.we'ird", acl: "anon:SELECT" }], { project: PROJECT, takenAt: "2026-11-13T12:00:00.000Z" });
    const sql = buildReconcileSql(d);
    expect(sql).toContain("'public.we''ird'");
    expect(sql).not.toContain("'public.we'ird'");
  });
});
