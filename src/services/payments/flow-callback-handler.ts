import "server-only";
import { rateLimitSubjectForRequest } from "@/integrations/payments/trusted-client-ip";
import { DeadlineExceededError, withDeadline } from "@/services/payments/deadline";
import { MAX_CALLBACK_BODY_BYTES, getFlowCallbackDeps, parseCallbackToken, receiveFlowNotificationDetailed } from "@/services/payments/flow-callback-service";

/** Flow requires a 200 in under 15 s (PLAN 7.2): the TOTAL budget (body read + limiter + inbox) stays well below it. */
export const CALLBACK_BUDGET_MS = 10_000;
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff", "Content-Type": "text/plain; charset=utf-8" };

/** Reads at most MAX bytes within the budget. null = malformed/oversized/aborted stream; throws DeadlineExceededError on timeout. */
async function readLimited(request: Request, signal: AbortSignal): Promise<string | null> {
  if (Number(request.headers.get("content-length") ?? "0") > MAX_CALLBACK_BODY_BYTES) return null;
  const reader = request.body?.getReader(); if (!reader) return null;
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const part = await withDeadline(signal, reader.read()); if (part.done) break;
      size += part.value.byteLength; if (size > MAX_CALLBACK_BODY_BYTES) return null;
      chunks.push(part.value);
    }
  } catch (error) { if (error instanceof DeadlineExceededError) throw error; return null; }
  finally { reader.cancel().catch(() => undefined); }
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Public Flow confirmation trigger (no cookies). It carries no trusted data: it is only persisted to the inbox.
 * One total deadline covers reading the body and both RPCs; pending work is aborted when it expires.
 * 200 is returned ONLY after durable persistence was confirmed inside the budget; otherwise a controlled non-200 so Flow can retry.
 */
export async function handleConfirmation(request: Request, budgetMs: number = CALLBACK_BUDGET_MS): Promise<Response> {
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/x-www-form-urlencoded")) return new Response("Unsupported", { status: 415, headers });
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), budgetMs);
  try {
    let body: string | null;
    try { body = await readLimited(request, controller.signal); } catch { return new Response("Request Timeout", { status: 408, headers: { ...headers, Connection: "close" } }); }
    if (body === null || parseCallbackToken(body) === null) return new Response("Invalid", { status: 400, headers });
    let receipt: Awaited<ReturnType<typeof receiveFlowNotificationDetailed>>;
    try { receipt = await receiveFlowNotificationDetailed(body, getFlowCallbackDeps(), rateLimitSubjectForRequest(request.headers), controller.signal); } catch { receipt = { outcome: "unavailable" }; }
    if (controller.signal.aborted && receipt.outcome === "accepted") receipt = { outcome: "unavailable" }; // budget spent: persistence cannot be credited
    const outcome = receipt.outcome;
    if (outcome === "rate_limited") return new Response("Too Many Requests", { status: 429, headers: { ...headers, "Retry-After": String(receipt.retryAfterSeconds ?? 60) } });
    if (outcome === "accepted") return new Response("OK", { status: 200, headers });
    if (outcome === "rejected") return new Response("Invalid", { status: 400, headers });
    return new Response("Unavailable", { status: 503, headers: { ...headers, "Retry-After": "30" } });
  } finally { clearTimeout(timer); }
}
