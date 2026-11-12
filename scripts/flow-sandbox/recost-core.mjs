// Durable, idempotent core of the one-off Flow-cost data correction (no I/O of its own: everything is injected, so interruptions can be tested).
// For every order: (1) decide the new cost, (2) PERSIST an intent {order, from, to, state:'intent'} in the manifest log BEFORE touching the database,
// (3) apply `UPDATE ... WHERE cost IS NOT DISTINCT FROM from ... RETURNING`, (4) persist the outcome ('applied' | 'conflict').
// A rerun after an interruption recovers: an intent whose database value already equals `to` is closed as applied (recovered, the old value is kept in the
// intent); one still at `from` is applied; anything else is a conflict that is recorded and never overwritten.

/**
 * @param {{ rows: Array<{ id: string, cost: number|null }>, getCost: (row: any) => Promise<number|null>, readCost: (id: string) => Promise<number|null>,
 *   applyUpdate: (id: string, from: number|null, to: number) => Promise<Array<{ flow_cost_clp: number|null }>>,
 *   load: () => Promise<any>, save: (m: any) => Promise<void>, now?: () => string }} deps
 */
export async function runCostCorrection({ rows, getCost, readCost, applyUpdate, load, save, now = () => new Date().toISOString() }) {
  const summary = { applied: 0, recovered: 0, skipped: 0, conflicts: 0 };
  for (const row of rows) {
    const m = await load(); const log = (m.costCorrectionLog ??= []);
    const current = await readCost(row.id);
    let entry = [...log].reverse().find(e => e.order === row.id && e.state === 'intent');
    if (entry) {
      if (current === entry.to) { entry.state = 'applied'; entry.recovered = true; entry.completedAt = now(); await save(m); summary.recovered++; continue; }
      if (current !== entry.from) { entry.state = 'conflict'; entry.found = current; entry.completedAt = now(); await save(m); summary.conflicts++; continue; }
      const again = await getCost(row);
      if (again === null) { summary.skipped++; continue; }
      if (again !== entry.to) { entry.to = again; entry.revisedAt = now(); await save(m); }
    } else {
      const to = await getCost(row);
      if (to === null || to === current) { summary.skipped++; continue; }
      entry = { order: row.id, from: current, to, state: 'intent', at: now() }; log.push(entry); await save(m);          // durable BEFORE the update
    }
    const result = await applyUpdate(row.id, entry.from, entry.to);
    const m2 = await load(); const e2 = [...(m2.costCorrectionLog ??= [])].reverse().find(e => e.order === row.id && e.state === 'intent');
    if (result.length === 1 && result[0].flow_cost_clp === entry.to) { e2.state = 'applied'; summary.applied++; } else { e2.state = 'conflict'; e2.found = result[0]?.flow_cost_clp ?? null; summary.conflicts++; }
    e2.completedAt = now(); await save(m2);
  }
  return summary;
}
