// Synthetic accounts and jobs for the remote Flow Sandbox run. Every created id is written to the manifest the moment it exists.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { buildRetireCriterionSql } from './logic.mjs';
import { PROJECT_REF, SITE, actorClient, lit, readManifest, readSecrets, rpc, serviceClient, sql, stamp, writeManifest, writeSecrets } from './lib.mjs';

const password = () => `Flow-${randomBytes(14).toString('hex')}9aZ`;

/** Digest of the SHARED configuration this run is allowed to touch (category requirements). It must be identical before the run and after `retireCriterion`. */
export const sharedConfigDigest = async () => (await sql(`select count(*)::int n, md5(coalesce(string_agg(t::text,E'\n' order by t::text),'')) d from private.category_requirements t`))[0];

/** Removes the run's synthetic requirement BY ITS UUID in ONE transaction: the applications and the requirements are locked (a concurrent submission cannot pick the
 *  requirement up between the check and the delete), references are verified, the row is deleted and the shared-configuration digest is validated; any
 *  discrepancy RAISES and the delete is rolled back. The digest is also re-read afterwards for the manifest. */
export async function retireCriterion() {
  const m = await readManifest(); assert.ok(m?.criterion && m.sharedConfigBefore, 'sin criterio ni digest previo en el manifiesto');
  await sql(buildRetireCriterionSql({ criterion: m.criterion, run: m.run, technician: m.accounts.technician.id, before: m.sharedConfigBefore }));
  const after = await sharedConfigDigest(); assert.deepEqual(after, m.sharedConfigBefore);
  m.criterionRetiredAt = stamp(); m.notes.push(`${stamp()} criterio sintético retirado en una transacción con bloqueos y configuración compartida idéntica a la previa`); await writeManifest(m); return { removed: 1, digest: after };
}

/** Creates the three synthetic accounts, approves the technician with a synthetic criterion and authorizes ONLY the customer for Sandbox payments. */
export async function setup(env) {
  assert.equal(await readManifest(), null, 'ya existe un manifiesto: use cleanup antes de repetir setup');
  const pre = (await sql(`select (select count(*)::int from auth.users) users,(select count(*)::int from public.jobs) jobs,(select count(*)::int from private.payment_orders) orders,(select count(*)::int from private.payment_sandbox_accounts) allowed,(select count(*)::int from private.category_requirements) reqs,(select count(*)::int from private.technician_applications) apps`))[0];
  // The technician approval below needs ONE active requirement for the category (SHARED configuration): refuse to touch it while a real applicant could be affected.
  assert.deepEqual(pre, { users: 2, jobs: 0, orders: 0, allowed: 0, reqs: 0, apps: 0 }, 'el estado remoto no es el esperado (sólo los dos usuarios originales y sin datos): ' + JSON.stringify(pre));
  const run = 's05f' + randomBytes(3).toString('hex'), admin = serviceClient(env);
  const sharedConfigBefore = await sharedConfigDigest();
  const manifest = { run, project: PROJECT_REF, sharedConfigBefore, site: SITE, createdAt: stamp(), state: 'setup', preflight: pre, accounts: {}, criterion: null, requests: [], quotes: [], jobs: [], orders: [], attempts: [], notes: [] };
  const secrets = { run, accounts: {} };
  await writeManifest(manifest); await writeSecrets(secrets);                           // manifest first: nothing exists that it does not list
  for (const [label, type] of [['customer', 'customer'], ['technician', 'technician'], ['superadmin', 'customer']]) {
    const email = `${run}-${label}@sandbox.fixo.invalid`, pw = password();
    const meta = { first_name: 'Sintético', last_name: `Flow ${label}`, phone: '+56912345678', terms_accepted: true, account_type: type, ...(type === 'technician' ? { category_ids: ['gasfiteria'], coverage_areas: ['Ñuñoa'] } : {}) };
    const created = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: meta });
    assert.equal(created.error, null, 'createUser ' + label + ': ' + created.error?.message);
    manifest.accounts[label] = { id: created.data.user.id, email, createdAt: stamp() }; secrets.accounts[label] = { id: created.data.user.id, email, password: pw };
    await writeManifest(manifest); await writeSecrets(secrets);
  }
  const id = l => manifest.accounts[l].id;
  await sql(`update public.profiles set role='superadmin' where id=${lit(id('superadmin'))};`);
  const [crit] = await sql(`insert into private.category_requirements(category_id,requirement_key,version,kind,required,document_type,description,created_by) values('gasfiteria',${lit(run)},1,'internal',false,'other','Criterio sintético de la prueba Flow Sandbox',${lit(id('superadmin'))}) returning id`);
  manifest.criterion = crit.id; await writeManifest(manifest);
  await sql(`update private.technician_applications set state='approved',primary_category='gasfiteria',requirement_snapshot=array(select id from private.category_requirements where active and category_id='gasfiteria' order by id),consent_at=now() where technician_id=${lit(id('technician'))};
update private.technician_applications set approved_fingerprint=private.professional_fingerprint(technician_id) where technician_id=${lit(id('technician'))};
update public.technician_profiles set status='active' where user_id=${lit(id('technician'))};`);
  const sup = await actorClient(env, secrets, 'superadmin');
  await rpc(sup, 'payment_sandbox_account_set', { target_user: id('customer'), enabled: true, change_reason: `Cuenta sintética ${run} de la prueba Flow Sandbox (fase C)` });
  manifest.notes.push(`${stamp()} cuenta cliente autorizada para pagos Sandbox`); await writeManifest(manifest);
  return manifest;
}

/** One awarded job (request -> quote -> accepted quote) between the synthetic customer and technician. Returns { job, request, quote }. */
export async function createJob(env, label = 'trabajo') {
  const manifest = await readManifest(), secrets = await readSecrets(); assert.ok(manifest && manifest.state !== 'cleaned', 'sin manifiesto vigente');
  const customer = await actorClient(env, secrets, 'customer'), tech = await actorClient(env, secrets, 'technician');
  await sql(`update public.service_requests set created_at=now()-interval '3 days' where customer_id=${lit(customer.id)};`);
  const r = await rpc(customer, 'marketplace_create_request', { operation_id: randomUUID(), payload: { title: `Prueba Flow Sandbox ${manifest.run} ${label}`, categoryId: 'gasfiteria', description: 'Solicitud sintética para la matriz de pruebas Flow Sandbox.', locationLabel: 'Nunoa', address: 'Dirección sintética privada', reference: 'Referencia sintética', preferredSlot: 'Mañana', scheduledFor: null } });
  manifest.requests.push({ id: r.id, createdAt: stamp() }); await writeManifest(manifest);
  const payload = { laborClp: 20000, materialsClp: 5000, diagnosticClp: 0, description: 'Reparación sintética para la prueba Flow Sandbox.', materialsIncluded: 'Sello', materialsNotIncluded: '', diagnosticVisit: false, estimatedDuration: '2 horas', availableDate: new Date(Date.now() + 86400000).toISOString(), conditions: 'Sólo prueba', expiresAt: new Date(Date.now() + 172800000).toISOString() };
  let q = await rpc(tech, 'marketplace_save_quote', { request_id: r.id, operation_id: randomUUID(), payload });
  manifest.quotes.push({ id: q.id, createdAt: stamp() }); await writeManifest(manifest);
  q = await rpc(tech, 'marketplace_transition_quote', { quote_id: q.id, next_status: 'submitted', expected_revision: q.revision });
  const awarded = await rpc(customer, 'marketplace_accept_quote', { request_id: r.id, quote_id: q.id, expected_revision: q.revision });
  manifest.jobs.push({ id: awarded.job.id, label, createdAt: stamp() }); await writeManifest(manifest);
  return { job: awarded.job.id, request: r.id, quote: q.id };
}
