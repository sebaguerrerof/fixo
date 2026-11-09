// Fail-closed adapter for SQL connectors that return only the last result set.
// PostgreSQL's parser supplies UTF-8 statement boundaries; fixtures always roll back.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { parse } from "pgsql-parser";

const input = process.argv[2];
if (!input || !/^supabase[\\/]tests[\\/][\w.-]+\.sql$/.test(input)) throw new Error("Expected a repository pgTAP test");
const source = Buffer.from(await readFile(input));
const ast = await parse(source.toString());
const chunks = [];
let count = 0;
let helperAdded = false;
let rolledBack = false;
for (const entry of ast.stmts) {
  const start = entry.stmt_location ?? 0;
  const statement = source.subarray(start, entry.stmt_len ? start + entry.stmt_len : undefined).toString().trim();
  const select = entry.stmt.SelectStmt;
  const call = select?.targetList?.[0]?.ResTarget?.val?.FuncCall;
  const name = call?.funcname?.at(-1)?.String?.sval;
  if (name === "plan" || name === "no_plan") {
    chunks.push(`create temporary table fixo_tap_results(line text);
create function pg_temp.fixo_capture(line text) returns text
language plpgsql security definer set search_path=pg_catalog as $capture$
begin
  insert into pg_temp.fixo_tap_results values(line);
  if line ~ '^not ok' or line ~ '^# Looks like' then raise exception '%',line; end if;
  return line;
end $capture$;`);
    helperAdded = true;
  }
  if (["ok", "is", "throws_ok", "lives_ok"].includes(name)) {
    count++;
    chunks.push(`select pg_temp.fixo_capture(result) from (${statement}) as tap(result);`);
  } else if (select?.fromClause?.[0]?.RangeFunction?.functions?.[0]?.[0]?.FuncCall?.funcname?.at(-1)?.String?.sval === "finish") {
    chunks.push("select pg_temp.fixo_capture(result) from finish() as tap(result);");
  } else if (entry.stmt.TransactionStmt?.kind === "TRANS_STMT_ROLLBACK") {
    chunks.push(`do $verify$ begin
if (select count(*) from pg_temp.fixo_tap_results where line ~ '^ok [0-9]+') <> ${count} then
raise exception 'Incomplete pgTAP assertion results'; end if;
end $verify$;\nrollback;`);
    rolledBack = true;
  } else chunks.push(statement.replace(/;\s*$/, "") + ";");
}
if (!helperAdded || !rolledBack || !count) throw new Error("Unsupported test structure");
chunks.push(`select jsonb_build_object('file','${basename(input)}','assertions',${count},'status','PASS','rolled_back',true) as fixo_test_result;`);
const output = resolve(".audit-backups/sprint02-pgtap", basename(input));
await mkdir(resolve(".audit-backups/sprint02-pgtap"), { recursive: true });
await writeFile(output, chunks.join("\n\n") + "\n");
console.log(JSON.stringify({output, assertions: count}));
