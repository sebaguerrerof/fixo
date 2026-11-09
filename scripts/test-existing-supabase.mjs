// Opt-in integration runner for the explicitly authorized Fixo development database.
// Credentials stay in process memory. No email sending API is called.
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createInterface } from "node:readline";
import { createClient } from "@supabase/supabase-js";

const ref = "rjzyqdhotcshvbdcrgon";
if (process.env.FIXO_EXISTING_PROJECT_AUTHORIZED !== ref) {
  console.error("BLOCKED: explicit authorization for the existing Fixo test target required.");
  process.exit(2);
}
const env = {};
for (const line of (await readFile(".env.local", "utf8")).split(/\r?\n/)) {
  const match = line.match(/^([A-Z_][A-Z_0-9]*)\s*=\s*(.*)$/);
  if (match) env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
}
const endpoint = env.NEXT_PUBLIC_SUPABASE_URL;
assert.equal(new URL(endpoint).hostname, ref + ".supabase.co", "Unexpected project; no requests made");
assert.ok(env.SUPABASE_SERVICE_ROLE_KEY && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, "Required credentials missing; no requests made");
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(endpoint, env.SUPABASE_SERVICE_ROLE_KEY, options);
const client = () => createClient(endpoint, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, options);
const runId = randomUUID();
const dir = ".audit-backups/sprint02-native/" + runId;
await mkdir(dir, { recursive: true });
const manifest = { runId, project: ref, actors: [], extraUsers: [], invitations: [], objects: [] };
const checks = [];
const lines = createInterface({ input: process.stdin });
const iterator = lines[Symbol.asyncIterator]();
async function checkpoint(stage) {
  manifest.stage = stage;
  await writeFile(dir + "/manifest.json", JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ checkpoint: stage, manifest: dir + "/manifest.json" }));
  const next = await iterator.next();
  assert.equal(next.value?.trim(), stage + "-ready", "Controlled fixture preparation not acknowledged");
}
async function test(name, run) {
  manifest.currentCheck = name;
  await run(); checks.push(name); console.log("PASS " + name);
}
const password = () => "Fixo-Synthetic-" + randomBytes(20).toString("hex") + "9aA";
const metadata = label => ({ first_name: "Synthetic", last_name: label, phone: "+56912345678", terms_accepted: true, fixo_test_run: runId });
async function makeActor(label, type = "customer") {
  const email = `fixo-test-${runId}-${label}@local.invalid`, pw = password();
  const result = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { ...metadata(label), account_type: type, role: "superadmin" } });
  assert.equal(result.error, null, "Synthetic actor creation failed");
  manifest.actors.push({ label, id: result.data.user.id, email });
  await writeFile(dir + "/manifest.json", JSON.stringify(manifest, null, 2));
  const api = client();
  const login = await api.auth.signInWithPassword({ email, password: pw });
  assert.equal(login.error, null, "Synthetic actor login failed");
  return { api, email, pw, user: login.data.user, session: login.data.session };
}
const rpcChange = (actor, target, status, role = null) => actor.api.rpc("admin_change_account", { target_user: target.user.id, new_status: status, new_role: role, change_reason: "Synthetic integration verification", operation_id: randomUUID() });
let signedUrl;
try {
  const c1 = await makeActor("customer-one"), c2 = await makeActor("customer-two");
  const t1 = await makeActor("technician-one", "technician"), t2 = await makeActor("technician-two", "technician");
  const m = await makeActor("moderator"), s1 = await makeActor("admin-one"), s2 = await makeActor("admin-two");
  await checkpoint("roles");
  await test("metadata cannot grant privileged roles", async () => {
    assert.equal((await c1.api.rpc("my_account_access")).data.role, "customer");
    assert.equal((await t1.api.rpc("my_account_access")).data.role, "technician");
  });
  await test("pending technician is hidden from public directory", async () => assert.equal((await client().from("technician_profiles").select("user_id").eq("user_id", t1.user.id)).data.length, 0));
  await test("customers cannot read each other or elevate access", async () => {
    assert.equal((await c1.api.from("profiles").select("id").eq("id", c2.user.id)).data.length, 0);
    assert.ok((await c1.api.from("profiles").update({ role: "superadmin", account_status: "active" }).eq("id", c1.user.id)).error);
    assert.ok((await c1.api.rpc("admin_list_users")).error);
  });
  await test("own profile persists through guarded RPC", async () => {
    assert.equal((await c1.api.rpc("update_my_profile", { first_name: "Synthetic", last_name: "Updated", phone_number: "+56912345678", professional: null })).error, null);
    assert.equal((await c1.api.rpc("my_profile")).data.phone, "+56912345678");
  });
  let requestId;
  await test("own submitted request persists and overposting is denied", async () => {
    const result = await c1.api.from("service_requests").insert({ customer_id: c1.user.id, category_id: "electricidad", title: "Solicitud sintética", location_label: "Ñuñoa" }).select("id,status").single();
    assert.equal(result.error, null); assert.equal(result.data.status, "submitted"); requestId = result.data.id;
    assert.ok((await c1.api.from("service_requests").insert({ customer_id: c1.user.id, category_id: "electricidad", title: "Estado manipulado", location_label: "Ñuñoa", status: "completed" })).error);
    assert.equal((await c2.api.from("service_requests").select("id").eq("id", requestId)).data.length, 0);
  });
  await test("moderator filters accounts and cannot administer privileged actors", async () => {
    const listed = await m.api.rpc("admin_list_users", { search_text: "Synthetic", role_filter: "customer", status_filter: "active", page_number: 1 });
    assert.equal(listed.error, null); assert.ok(listed.data.total >= 2);
    assert.ok((await rpcChange(m, s1, "suspended")).error);
    assert.ok((await rpcChange(m, c1, null, "superadmin")).error);
  });
  await test("suspension blocks the previous JWT and reactivation is audited", async () => {
    assert.equal((await rpcChange(m, c1, "suspended")).error, null);
    assert.equal((await c1.api.rpc("my_account_access")).data.allowed, false);
    assert.ok((await c1.api.from("service_requests").insert({ customer_id: c1.user.id, category_id: "electricidad", title: "Suspended", location_label: "Ñuñoa" })).error);
    assert.equal((await rpcChange(m, c1, "active")).error, null);
    assert.equal((await c1.api.rpc("my_account_access")).data.allowed, true);
    const detail = await s1.api.rpc("admin_user_detail", { target_user: c1.user.id });
    assert.equal(detail.error, null); assert.ok(detail.data.history.some(event => event.action === "account_status_changed" && event.actor_id === m.user.id));
  });
  const path = t1.user.id + "/" + runId + ".pdf";
  await test("Storage owner upload works and cross-owner access is denied", async () => {
    assert.equal((await t1.api.storage.from("technician-documents").upload(path, Buffer.from("%PDF-1.4 synthetic integration fixture"), { contentType: "application/pdf" })).error, null);
    manifest.objects.push(path);
    assert.ok((await t2.api.storage.from("technician-documents").download(path)).error);
    assert.ok((await t2.api.storage.from("technician-documents").upload(t1.user.id + "/forged.pdf", Buffer.from("%PDF-test"), { contentType: "application/pdf" })).error);
  });
  await test("Storage HTTP rejects MIME and oversize files", async () => {
    assert.ok((await t1.api.storage.from("technician-documents").upload(t1.user.id + "/bad.txt", Buffer.from("text"), { contentType: "text/plain" })).error);
    assert.ok((await t1.api.storage.from("technician-documents").upload(t1.user.id + "/oversize.pdf", Buffer.alloc(10485761), { contentType: "application/pdf" })).error);
  });
  await test("owner receives a working signed URL with a 60-second lifetime", async () => {
    const result = await t1.api.storage.from("technician-documents").createSignedUrl(path, 60);
    assert.equal(result.error, null); signedUrl = result.data.signedUrl;
    assert.equal((await fetch(signedUrl)).status, 200);
  });
  await test("approved professional disappears on account suspension", async () => {
    for (const status of ["verified", "active"]) assert.equal((await s1.api.rpc("change_technician_status", { target_technician_id: t1.user.id, next_status: status, change_reason: "Synthetic integration review" })).error, null);
    assert.equal((await client().from("technician_profiles").select("user_id").eq("user_id", t1.user.id)).data.length, 1);
    assert.equal((await rpcChange(m, t1, "suspended")).error, null);
    assert.equal((await client().from("technician_profiles").select("user_id").eq("user_id", t1.user.id)).data.length, 0);
    assert.ok((await t1.api.storage.from("technician-documents").upload(t1.user.id + "/suspended.pdf", Buffer.from("%PDF-test"), { contentType: "application/pdf" })).error);
  });
  let signupHash, signupEmail, signupPassword;
  await test("native signup link creates an unconfirmed identity without sending email", async () => {
    signupEmail = `fixo-test-${runId}-confirm@local.invalid`; signupPassword = password();
    const result = await admin.auth.admin.generateLink({ type: "signup", email: signupEmail, password: signupPassword, options: { data: metadata("Confirmation") } });
    assert.equal(result.error, null); signupHash = result.data.properties.hashed_token;
    manifest.extraUsers.push({ id: result.data.user.id, email: signupEmail });
    assert.ok((await client().auth.signInWithPassword({ email: signupEmail, password: signupPassword })).error);
  });
  await test("confirmation OTP works in another client and rejects reuse", async () => {
    const result = await client().auth.verifyOtp({ token_hash: signupHash, type: "email" });
    assert.equal(result.error, null); assert.ok(result.data.session);
    assert.ok((await client().auth.verifyOtp({ token_hash: signupHash, type: "email" })).error);
  });
  await test("native recovery verifies once and changes password", async () => {
    const generated = await admin.auth.admin.generateLink({ type: "recovery", email: signupEmail }); assert.equal(generated.error, null);
    const recovery = client(), hash = generated.data.properties.hashed_token;
    assert.equal((await recovery.auth.verifyOtp({ token_hash: hash, type: "recovery" })).error, null);
    assert.equal((await recovery.auth.updateUser({ password: signupPassword + "New" })).error, null);
    assert.ok((await client().auth.verifyOtp({ token_hash: hash, type: "recovery" })).error);
    assert.equal((await client().auth.signInWithPassword({ email: signupEmail, password: signupPassword + "New" })).error, null);
  });
  let invitation, invited;
  const inviteEmail = `fixo-test-${runId}-invited@local.invalid`;
  await test("invitation reservation is idempotent and rejects moderator escalation", async () => {
    assert.ok((await m.api.rpc("admin_reserve_invitation", { invite_email: inviteEmail, invite_name: "Synthetic Invite", invite_role: "superadmin", operation_id: randomUUID(), resend: false })).error);
    const args = { invite_email: inviteEmail, invite_name: "Synthetic Invite", invite_role: "technician", operation_id: randomUUID(), resend: false };
    const result = await m.api.rpc("admin_reserve_invitation", args); assert.equal(result.error, null); invitation = result.data;
    manifest.invitations.push(invitation.id); assert.equal(invitation.send, true);
    assert.equal((await m.api.rpc("admin_reserve_invitation", args)).data.send, false);
    assert.equal((await m.api.rpc("admin_reserve_invitation", { ...args, operation_id: randomUUID() })).data.send, false);
    assert.ok((await m.api.rpc("admin_reserve_invitation", { ...args, operation_id: randomUUID(), resend: true })).error);
  });
  await test("native invite OTP permits acceptance but never professional approval", async () => {
    const generated = await admin.auth.admin.generateLink({ type: "invite", email: inviteEmail, options: { data: { full_name: "Synthetic Invited", fixo_test_run: runId, role: "superadmin" } } }); assert.equal(generated.error, null);
    manifest.extraUsers.push({ id: generated.data.user.id, email: inviteEmail });
    const api = client(), result = await api.auth.verifyOtp({ token_hash: generated.data.properties.hashed_token, type: "invite" });
    assert.equal(result.error, null); invited = { api, user: result.data.user, session: result.data.session };
    assert.equal((await api.rpc("my_account_access")).data.allowed, false);
    assert.equal((await api.auth.updateUser({ password: password() })).error, null);
    assert.equal((await api.rpc("accept_my_invitation", { first_name: "Synthetic", last_name: "Invited", phone_number: "+56912345678", terms_accepted: true })).error, null);
    assert.equal((await api.rpc("my_account_access")).data.role, "technician");
    assert.equal((await api.from("technician_profiles").select("status").eq("user_id", invited.user.id).single()).data.status, "pending_verification");
  });
  await test("recovery proof is session-bound and consumed exactly once concurrently", async () => {
    const hash = createHash("sha256").update(randomBytes(32)).digest("hex");
    const sessionId = JSON.parse(Buffer.from(c1.session.access_token.split(".")[1], "base64url")).session_id;
    const args = { flow_hash: hash, target_user: c1.user.id, target_session: sessionId, flow_kind: "recovery" };
    assert.ok((await c1.api.rpc("issue_auth_flow", args)).error);
    assert.equal((await admin.rpc("issue_auth_flow", args)).error, null);
    assert.ok((await c2.api.rpc("check_auth_flow", { flow_hash: hash, consume: false })).error);
    const result = await Promise.all([c1.api.rpc("check_auth_flow", { flow_hash: hash, consume: true }), c1.api.rpc("check_auth_flow", { flow_hash: hash, consume: true })]);
    assert.equal(result.filter(row => !row.error).length, 1);
  });
  await test("refresh rotates a real session", async () => {
    const result = await c2.api.auth.refreshSession(); assert.equal(result.error, null);
    assert.ok(result.data.session); assert.notEqual(result.data.session.refresh_token, c2.session.refresh_token);
  });
  await test("concurrent synthetic administrator suspensions serialize", async () => {
    const result = await Promise.all([rpcChange(s1, s2, "blocked"), rpcChange(s2, s1, "blocked")]);
    assert.equal(result.filter(row => !row.error).length, 1);
  });
  await test("global signout blocks operations using the old JWT", async () => {
    const old = createClient(endpoint, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { ...options, global: { headers: { Authorization: "Bearer " + c2.session.access_token } } });
    assert.equal((await c2.api.auth.signOut({ scope: "global" })).error, null);
    assert.equal((await old.rpc("my_account_access")).data.allowed, false);
  });
  await checkpoint("expiry");
  await test("expired signed Storage token is rejected at origin", async () => {
    const uncached = new URL(signedUrl);
    uncached.searchParams.set("cacheNonce", randomUUID());
    assert.notEqual((await fetch(uncached, { cache: "no-store" })).status, 200);
  });
  manifest.status = "PASS";
} catch (error) {
  manifest.status = "FAIL";
  // Detailed assertions may contain confidential values: keep local and ignored.
  await writeFile(dir + "/failure.txt", String(error.stack));
  console.error(JSON.stringify({ status: "FAIL", check: manifest.currentCheck, code: error.code ?? "RUNTIME", checksPassed: checks.length }));
  process.exitCode = 1;
} finally {
  await writeFile(dir + "/manifest.json", JSON.stringify(manifest, null, 2));
  await writeFile("docs/production/sprint-02-evidence/native-integration.json", JSON.stringify({ project: ref, runId, status: manifest.status, checks, failedCheck: manifest.status === "FAIL" ? manifest.currentCheck : null, emailDelivery: "NOT TESTED: no mail-sending API called", signedUrlLimitation: "Expiry is enforced at origin; warmed CDN responses can outlive the token. See preserved failure evidence. Sensitive document delivery must reauthorize and use no-store.", fixtureCleanup: "PENDING", completedAt: new Date().toISOString() }, null, 2) + "\n");
  lines.close();
  console.log(JSON.stringify({ status: manifest.status, checks: checks.length, manifest: dir + "/manifest.json" }));
}
