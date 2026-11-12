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
  if (!isWorkerAuthorized(request.headers.get("authorization"), secret)) return json(401, { error: "unauthorized" });
  try { return json(200, await runPaymentWorkerBatch(makeDeps())); }
  catch { return json(503, { error: "unavailable" }); }
}
