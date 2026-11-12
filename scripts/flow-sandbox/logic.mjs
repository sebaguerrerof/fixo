// Pure decision logic of the remote Flow Sandbox tooling (no I/O), so it can be unit-tested. See the tests in src/integrations/payments/flow-sandbox-tools.test.ts.

const SYNTHETIC = /^[a-z0-9][a-z0-9._+-]*@[a-z0-9-]+(\.[a-z0-9-]+)*\.invalid$/i;
const DELIVERABLE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

/** Only the owner-configured Sandbox payer address or a well-formed synthetic `.invalid` address may be sent to Flow; any other address (a third party's) is refused. */
export function assertAllowedPayer(email, configured) {
  const e = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const c = typeof configured === 'string' ? configured.trim().toLowerCase() : '';
  if (!e) throw new Error('falta la dirección del pagador');
  if (SYNTHETIC.test(e)) return e;
  if (c && DELIVERABLE.test(c) && !c.endsWith('.invalid') && e === c) return e;
  throw new Error('dirección no autorizada para Flow Sandbox: sólo la configurada en FIXO_FLOW_SANDBOX_PAYER_EMAIL o una sintética .invalid');
}

/**
 * Classification of a payment/create exchange. `created` needs a 200 with token AND flowOrder. `refused` is reserved for the documented DEFINITIVE
 * request errors (HTTP 400/401) whose body is the documented {code,message}. Everything else (network loss, 3xx/403/404/429/5xx, a 200 with an unexpected body,
 * an unparseable error) is `ambiguous`: Flow may have created the order, so it must be recovered by commerceOrder before it can be discarded.
 */
export function classifyCreate({ http = null, bodyText = '', networkError = null } = {}) {
  if (networkError || http === null) return { state: 'ambiguous', http, reason: 'network' };
  let j = null; try { j = JSON.parse(bodyText); } catch { j = null; }
  if (http === 200) {
    if (j && typeof j === 'object' && typeof j.token === 'string' && j.token && /^[0-9]{1,15}$/.test(String(j.flowOrder ?? ''))) return { state: 'created', http, flowOrder: String(j.flowOrder) };
    return { state: 'ambiguous', http, reason: 'unexpected_success_body' };
  }
  if ((http === 400 || http === 401) && j && typeof j === 'object' && Number.isInteger(j.code) && typeof j.message === 'string') return { state: 'refused', http, code: j.code, message: j.message.slice(0, 200) };
  return { state: 'ambiguous', http, reason: http >= 500 ? 'server_error' : 'unexpected_response' };
}

const FLOW_STATES = { 1: 'pending', 2: 'paid', 3: 'rejected', 4: 'cancelled' };

/**
 * Reconciliation of one external diagnostic order against a Flow status answer. Validates HTTP, structure and IDENTITY against the original entry
 * (commerceOrder, and flowOrder when known) before concluding anything. `open` stays true for pending, paid-outside-Fixo (needs a human), unknown and any error.
 */
export function classifyReconciliation(entry, { http = null, json = null, networkError = null } = {}) {
  const base = { flowState: 'unknown', open: true };
  if (networkError || http === null) return { ...base, problem: 'query_failed' };
  if (http !== 200) return { ...base, problem: 'query_http_' + http };
  if (!json || typeof json !== 'object' || typeof json.commerceOrder !== 'string' || !/^[0-9]{1,15}$/.test(String(json.flowOrder ?? '')) || !Number.isInteger(Number(json.status))) return { ...base, problem: 'invalid_structure' };
  if (json.commerceOrder !== entry.commerceOrder) return { ...base, problem: 'identity_mismatch_commerce_order' };
  if (entry.flowOrder && String(json.flowOrder) !== String(entry.flowOrder)) return { ...base, problem: 'identity_mismatch_flow_order' };
  const flowState = FLOW_STATES[Number(json.status)] ?? 'unknown';
  const identity = { flowOrder: String(json.flowOrder), flowStatusCode: Number(json.status), amount: json.amount ?? null, currency: json.currency ?? null };
  if (flowState === 'rejected' || flowState === 'cancelled') return { ...identity, flowState, open: false };
  return { ...identity, flowState, open: true, problem: flowState === 'paid' ? 'paid_outside_fixo' : flowState === 'pending' ? 'still_payable' : 'unknown_state' };
}

/** Items that block considering the run closed: every external order whose latest reconciliation is not a final non-payable state, and any never reconciled. */
export function openExternalIssues(manifest) {
  return (manifest?.externalOrders ?? []).filter(e => !(e.reconciliation && e.reconciliation.open === false) && !(e.state === 'refused')).map(e => ({ commerceOrder: e.commerceOrder, flowOrder: e.flowOrder ?? null, state: e.state, reconciliation: e.reconciliation?.problem ?? (e.reconciliation ? e.reconciliation.flowState : 'never_reconciled') }));
}

/** Single-transaction SQL that retires the run's synthetic requirement. Locks the applications (blocks concurrent submissions until the end) and the requirements,
 *  verifies the references are only the synthetic technician's, deletes by UUID+key, and RAISES (rolling back the delete) unless the digest equals `before`. */
export function buildRetireCriterionSql({ criterion, run, technician, before }) {
  const lit = v => `'${String(v).replaceAll("'", "''")}'`;
  return `do $retire$
declare refs integer; gone integer; n integer; d text;
begin
 lock table private.technician_applications in exclusive mode;
 lock table private.category_requirements in access exclusive mode;
 select count(*) into refs from private.technician_applications a where ${lit(criterion)}::uuid = any(a.requirement_snapshot) and a.technician_id <> ${lit(technician)}::uuid;
 if refs > 0 then raise exception 'el criterio lo referencia algo ajeno al técnico sintético (%)', refs; end if;
 delete from private.category_requirements where id = ${lit(criterion)}::uuid and requirement_key = ${lit(run)};
 get diagnostics gone = row_count;
 select count(*)::int, md5(coalesce(string_agg(t::text, E'\\n' order by t::text), '')) into n, d from private.category_requirements t;
 if n <> ${Number(before.n)} or d <> ${lit(before.d)} then raise exception 'la configuración compartida no coincide con la previa (n=%, digest=%): se revierte el borrado', n, d; end if;
 if gone <> 1 then raise exception 'se esperaba retirar exactamente un criterio (%)', gone; end if;
end
$retire$;`;
}
