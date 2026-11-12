import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { getPaymentWorkerDeps, runPaymentWorkerBatch, type PaymentWorkerDeps } from "./payment-worker-service";

const HEADERS = { "cache-control": "no-store", "content-type": "application/json" } as const;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: HEADERS });
const digest = (v: string) => createHash("sha256").update(v, "utf8").digest();

/** Machine credential: an explicit, dedicated secret (>= 32 chars). Missing/short secret => the endpoint does not exist for anyone. */
export function isWorkerAuthorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 32 || !header?.startsWith("Bearer ")) return false;
  return timingSafeEqual(digest(header.slice(7)), digest(secret));
}

/** Runs ONE bounded batch. Meant for a scheduler/runner; never user-facing, never returns provider data. */
export async function handleWorkerRun(request: Request, secret: string | undefined = process.env.FIXO_PAYMENTS_WORKER_SECRET, makeDeps: () => PaymentWorkerDeps = getPaymentWorkerDeps): Promise<Response> {
  if (!isWorkerAuthorized(request.headers.get("authorization"), secret)) { log("payments_worker_rejected", { status: 401 }); return json(401, { error: "unauthorized" }); }
  const started = Date.now();
  try {
    const summary = await runPaymentWorkerBatch(makeDeps());
    // Counters only: no token, URL, amount or user data ever reaches the logs.
    log("payments_worker_run", { status: 200, ms: Date.now() - started, ...summary });
    return json(200, summary);
  } catch (error) {
    // Only the error CLASS is logged (messages may carry provider or configuration detail).
    log("payments_worker_error", { status: 503, ms: Date.now() - started, error: error instanceof Error ? error.name : "unknown" });
    return json(503, { error: "unavailable" });
  }
}

/** One JSON line per run so a log drain/alert can count runs, failures and housekeeping problems. */
function log(event: string, fields: Record<string, string | number>): void { console.info(JSON.stringify({ event, ...fields })); }
