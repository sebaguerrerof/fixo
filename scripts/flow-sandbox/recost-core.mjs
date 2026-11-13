// Durable, idempotent core of the one-off Flow-cost data correction (no I/O of its own: everything is injected, so interruptions can be tested).
// For every order: (1) decide the new cost, (2) PERSIST an intent {order, from, to, state:'intent'} in the manifest log BEFORE touching the database,
// (3) apply `UPDATE ... WHERE cost IS NOT DISTINCT FROM from ... RETURNING`, (4) persist the outcome ('applied' | 'conflict').
// A rerun after an interruption recovers: an intent whose database value already equals `to` is closed as applied (recovered, the old value is kept in the
// intent); one still at `from` is applied; anything else is a conflict that is recorded and never overwritten. An unresolved conflict blocks every later run for that order
// until someone sets `resolvedAt` on the entry (explicit resolution; the entry is kept as history).
// DRIFT: if the last entry is `applied` and the database no longer holds its `to`, someone changed the cost afterwards: a `conflict` (kind 'drift') is recorded and blocks the same way.
// Every intent has a unique `id`, outcomes are written to THAT intent, and the whole run holds an exclusive lock (`lock()` throws when another run holds it).

import { randomUUID } from 'node:crypto';

/** In-memory exclusive lock with the same contract as the manifest file lock (tests / single process). Fails fast, never queues. */
export function memoryLock() {
  let held = false;
  return async () => { if (held) throw new Error('otra corrección de costes está en curso (bloqueo exclusivo)'); held = true; return async () => { held = false; }; };
}

/**
 * @param {{ rows: Array<{ id: string, cost: number|null }>, getCost: (row: any) => Promise<number|null>, readCost: (id: string) => Promise<number|null>,
 *   applyUpdate: (id: string, from: number|null, to: number) => Promise<Array<{ flow_cost_clp: number|null }>>,
 *   load: () => Promise<any>, save: (m: any) => Promise<void>, now?: () => string, lock?: () => Promise<() => Promise<void>>, newId?: () => string }} deps
 */
export async function runCostCorrection({ rows, getCost, readCost, applyUpdate, load, save, now = () => new Date().toISOString(), lock = async () => async () => {}, newId = randomUUID }) {
  const release = await lock();                       // throws if another run holds it: never two runs over the same manifest
  try { return await run(); } finally { await release(); }
  async function run() {
    const summary = { applied: 0, recovered: 0, skipped: 0, conflicts: 0 };
    for (const row of rows) {
      const m = await load(); const log = (m.costCorrectionLog ??= []);
      const current = await readCost(row.id);
      const last = [...log].reverse().find(e => e.order === row.id);
      // An unresolved conflict BLOCKS the order: a foreign change is never overwritten on a rerun. A person must resolve it explicitly (set `resolvedAt` on that log entry); the history is kept.
      if (last && last.state === 'conflict' && !last.resolvedAt) { summary.conflicts++; continue; }
      // Drift after a completed correction: the database no longer holds the value the last applied correction left.
      if (last && last.state === 'applied' && current !== last.to) {
        log.push({ id: newId(), order: row.id, kind: 'drift', from: last.to, found: current, state: 'conflict', at: now() }); await save(m); summary.conflicts++; continue;
      }
      let entry = last && last.state === 'intent' ? last : null;
      if (entry) {
        entry.id ??= newId();
        if (current === entry.to) { entry.state = 'applied'; entry.recovered = true; entry.completedAt = now(); await save(m); summary.recovered++; continue; }
        if (current !== entry.from) { entry.state = 'conflict'; entry.found = current; entry.completedAt = now(); await save(m); summary.conflicts++; continue; }
        const again = await getCost(row);
        if (again === null) { summary.skipped++; continue; }
        if (again !== entry.to) { entry.to = again; entry.revisedAt = now(); }
        await save(m);
      } else {
        const to = await getCost(row);
        if (to === null || to === current) { summary.skipped++; continue; }
        entry = { id: newId(), order: row.id, from: current, to, state: 'intent', at: now() }; log.push(entry); await save(m);          // durable BEFORE the update
      }
      const result = await applyUpdate(row.id, entry.from, entry.to);
      const m2 = await load(); const e2 = (m2.costCorrectionLog ??= []).find(e => e.id === entry.id);
      if (!e2) throw new Error('la intención ' + entry.id + ' desapareció del manifiesto (¿edición concurrente?)');
      if (result.length === 1 && result[0].flow_cost_clp === entry.to) { e2.state = 'applied'; summary.applied++; } else { e2.state = 'conflict'; e2.found = result[0]?.flow_cost_clp ?? null; summary.conflicts++; }
      e2.completedAt = now(); await save(m2);
    }
    return summary;
  }
}
