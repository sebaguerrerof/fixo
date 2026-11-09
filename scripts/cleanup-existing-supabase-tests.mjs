// Cleanup is deliberately restricted to manifests from this explicit Fixo runner.
import assert from "node:assert/strict";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
const ref = "rjzyqdhotcshvbdcrgon";
assert.equal(process.env.FIXO_EXISTING_PROJECT_AUTHORIZED, ref);
const env = {};
for (const line of (await readFile(".env.local", "utf8")).split(/\r?\n/)) {
  const match = line.match(/^([A-Z_][A-Z_0-9]*)\s*=\s*(.*)$/);
  if (match) env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
}
assert.equal(new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname, ref + ".supabase.co");
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const base = ".audit-backups/sprint02-native";
const ids = [], runs = [];
for (const run of await readdir(base)) {
  if (!/^[0-9a-f-]{36}$/.test(run)) continue;
  const m = JSON.parse(await readFile(base + "/" + run + "/manifest.json", "utf8"));
  assert.equal(m.project, ref); assert.equal(m.runId, run);
  runs.push(run);
  for (const actor of [...m.actors, ...m.extraUsers]) {
    assert.match(actor.id, /^[0-9a-f-]{36}$/);
    assert.ok(actor.email.startsWith("fixo-test-" + run + "-") && actor.email.endsWith("@local.invalid"));
    const result = await admin.auth.admin.getUserById(actor.id);
    if (result.error?.code === "user_not_found") continue;
    assert.equal(result.error, null);
    assert.equal(result.data.user.user_metadata.fixo_test_run, run);
    assert.equal(result.data.user.email, actor.email);
    ids.push(actor.id);
  }
  if (process.argv[2] === "prepare" && m.objects.length) {
    for (const path of m.objects) assert.ok(m.actors.some(actor => path === actor.id + "/" + run + ".pdf" || (m.documentIds??[]).some(id => /^[0-9a-f-]{36}$/.test(id) && path === actor.id + "/" + id + ".pdf")));
    assert.equal((await admin.storage.from("technician-documents").remove(m.objects)).error, null);
  }
}
if (process.argv[2] === "prepare") {
  assert.ok(ids.length);
  const literals = ids.map(id => "'" + id + "'::uuid").join(",");
  const runLiterals = runs.map(run => "'" + run + "'").join(",");
  const sql = `begin;
create temporary table fixo_cleanup_ids(id uuid primary key);
insert into fixo_cleanup_ids select id from auth.users where id=any(array[${literals}])
and raw_user_meta_data->>'fixo_test_run' in (${runLiterals}) and email like 'fixo-test-%@local.invalid';
do $$ begin
if (select count(*) from fixo_cleanup_ids) <> ${ids.length} then raise exception 'Fixture identity changed'; end if;
if exists(select 1 from private.account_events e where (e.actor_id in(select id from fixo_cleanup_ids) or e.target_id in(select id from fixo_cleanup_ids))
and ((e.actor_id is not null and e.actor_id not in(select id from fixo_cleanup_ids)) or (e.target_id is not null and e.target_id not in(select id from fixo_cleanup_ids))))
then raise exception 'Audit references a non-fixture account'; end if;
if exists(select 1 from public.admin_audit_entries e where (e.actor_id in(select id from fixo_cleanup_ids) or e.technician_id in(select id from fixo_cleanup_ids))
and (e.actor_id not in(select id from fixo_cleanup_ids) or e.technician_id not in(select id from fixo_cleanup_ids)))
then raise exception 'Professional audit references a non-fixture account'; end if;
end $$;
do $$ begin
if exists(select 1 from private.professional_events e where (e.actor_id in(select id from fixo_cleanup_ids) or e.technician_id in(select id from fixo_cleanup_ids))
and ((e.actor_id is not null and e.actor_id not in(select id from fixo_cleanup_ids)) or (e.technician_id is not null and e.technician_id not in(select id from fixo_cleanup_ids))))
then raise exception 'Professional event references a non-fixture account'; end if;
if exists(select 1 from private.technician_applications a join private.category_requirements r on r.id=any(a.requirement_snapshot)
where r.created_by in(select id from fixo_cleanup_ids) and a.technician_id not in(select id from fixo_cleanup_ids))
then raise exception 'Non-fixture application uses test requirements'; end if;
end $$;
delete from private.professional_events where actor_id in(select id from fixo_cleanup_ids) or technician_id in(select id from fixo_cleanup_ids);
delete from public.technician_documents where technician_id in(select id from fixo_cleanup_ids);
delete from private.technician_applications where technician_id in(select id from fixo_cleanup_ids);
delete from private.category_requirements where created_by in(select id from fixo_cleanup_ids);
delete from private.account_events where actor_id in(select id from fixo_cleanup_ids) or target_id in(select id from fixo_cleanup_ids);
delete from public.admin_audit_entries where actor_id in(select id from fixo_cleanup_ids) and technician_id in(select id from fixo_cleanup_ids);
delete from private.user_invitations where actor_id in(select id from fixo_cleanup_ids) and email like 'fixo-test-%@local.invalid';
select count(*) as verified_fixture_accounts from fixo_cleanup_ids;
commit;`;
  await writeFile(base + "/cleanup.sql", sql);
  console.log(JSON.stringify({ prepared: ids.length, sql: base + "/cleanup.sql" }));
} else if (process.argv[2] === "users") {
  for (const id of ids) assert.equal((await admin.auth.admin.deleteUser(id)).error, null);
  console.log(JSON.stringify({ deletedSyntheticUsers: ids.length }));
} else throw new Error("Expected prepare or users phase");
