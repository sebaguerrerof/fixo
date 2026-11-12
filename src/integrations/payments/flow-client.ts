import "server-only";
import { z } from "zod";
import { FLOW_SANDBOX_CHECKOUT_HOST, type FlowConfig } from "./flow-config";
import { flowSignature } from "./flow-signature";
import { mapFlowStatus } from "./flow-status";

type SandboxConfig = Extract<FlowConfig, { mode: "sandbox" }>;
export type FlowFetch = (url: string, init: { method: "GET" | "POST"; headers?: Record<string, string>; body?: string; signal: AbortSignal; redirect: "error" }) => Promise<{ status: number; text(): Promise<string> }>;

/** Only the statuses Flow documents as request errors (400 invalid request, 401 not authorized) prove a refusal. Any other status (3xx/403/404/429/5xx, proxies, WAFs) is ambiguous. */
const FLOW_DEFINITIVE_REJECTION_STATUSES: ReadonlySet<number> = new Set([400, 401]);

/** Sanitized provider failure: never carries credentials, tokens or response bodies. */
export class FlowProviderError extends Error {
  constructor(readonly code: "timeout" | "network" | "http_error" | "invalid_response" | "unsafe_checkout", readonly httpStatus: number | null = null) {
    super(`Flow: ${code}`); this.name = "FlowProviderError";
  }
  /** The remote side may have processed the request (an unsafe checkout URL means Flow did create the order): reconcile, never recreate. */
  get ambiguous(): boolean { return !(this.code === "http_error" && this.httpStatus !== null && FLOW_DEFINITIVE_REJECTION_STATUSES.has(this.httpStatus)); }
}

/** Strict numbers only: JSON numbers or plain decimal digit strings. "", " ", false, null and "1e3" are NOT numbers (never coerced to 0). */
const strictInt = z.union([z.number(), z.string().regex(/^[0-9]{1,15}$/).transform(Number)]).pipe(z.number().int().safe());
/** Flow reports the cost as a decimal STRING with two decimals ("837.00" in the real Sandbox). Only an integer-valued amount is accepted; "837.50", "", "1e3" or negatives stay unknown (never rounded or coerced). */
const feeAmount = z.union([z.number().int().nonnegative().safe(), z.string().regex(/^[0-9]{1,15}(\.0{1,2})?$/).transform(Number)]).pipe(z.number().int().nonnegative().safe());
const createResponse = z.object({ url: z.string().min(1), token: z.string().min(1).max(256), flowOrder: strictInt.pipe(z.number().positive()) });
const statusResponse = z.object({
  flowOrder: strictInt.pipe(z.number().positive()),
  commerceOrder: z.string().min(1).max(255),
  status: strictInt,
  currency: z.string().min(1).max(8),
  amount: strictInt,
  paymentData: z.object({ fee: z.unknown().optional() }).passthrough().nullable().optional(),
}).passthrough();

export interface FlowCreateInput { readonly commerceOrder: string; readonly subject: string; readonly amountClp: number; readonly email: string; readonly confirmationPath: string; readonly returnPath: string }
export interface FlowCreated { readonly flowOrder: number; readonly token: string; readonly checkoutUrl: string }
export interface FlowObservation {
  readonly flowOrder: number; readonly commerceOrder: string; readonly statusCode: number; readonly status: ReturnType<typeof mapFlowStatus>;
  readonly currency: string; readonly amountClp: number; readonly feeClp: number | null;
}

/** Only the exact sandbox HTTPS host is accepted for redirecting the browser. Returns origin + path without query. */
function assertSandboxCheckoutOrigin(url: string): string {
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new FlowProviderError("unsafe_checkout"); }
  if (parsed.protocol !== "https:" || parsed.hostname !== FLOW_SANDBOX_CHECKOUT_HOST || parsed.port || parsed.username || parsed.password || parsed.hash) throw new FlowProviderError("unsafe_checkout");
  return `${parsed.origin}${parsed.pathname}`;
}

/** Re-validates a previously stored checkout URL before reusing it: exact host and only a `token` query parameter. */
export function validateStoredCheckoutUrl(url: string): string {
  const base = assertSandboxCheckoutOrigin(url); const params = new URL(url).searchParams;
  const token = params.get("token");
  if (!token || [...params.keys()].some((k) => k !== "token")) throw new FlowProviderError("unsafe_checkout");
  return `${base}?token=${encodeURIComponent(token)}`;
}

/** Documented Flow limit for `commerceOrder` (error 1622 above it). Our references are `fixo-sbx-` + 32 hex = 41 characters. */
export const FLOW_MAX_COMMERCE_ORDER_LENGTH = 45;

/** The request was provably never sent (local validation). Only this class allows closing an attempt as not sent. */
export class FlowPreSendError extends Error { constructor(message: string) { super(message); this.name = "FlowPreSendError"; } }

export class FlowClient {
  constructor(private readonly config: SandboxConfig, private readonly doFetch: FlowFetch = (u, i) => fetch(u, i), private readonly timeoutMs = 10_000) {}

  async createPayment(input: FlowCreateInput): Promise<FlowCreated> {
    if (!Number.isSafeInteger(input.amountClp) || input.amountClp <= 0) throw new FlowPreSendError("Importe CLP inválido.");
    // Flow (Sandbox, code 1622) rejects a commerceOrder longer than 45 characters: never send a request we know will be refused.
    if (input.commerceOrder.length < 1 || input.commerceOrder.length > FLOW_MAX_COMMERCE_ORDER_LENGTH) throw new FlowPreSendError("Referencia de comercio inválida.");
    const params: Record<string, string> = {
      amount: String(input.amountClp), apiKey: this.config.apiKey, commerceOrder: input.commerceOrder, currency: "CLP", email: input.email,
      subject: input.subject, urlConfirmation: `${this.config.callbackOrigin}${input.confirmationPath}`, urlReturn: `${this.config.callbackOrigin}${input.returnPath}`,
    };
    const body = new URLSearchParams({ ...params, s: flowSignature(params, this.config.secretKey) }).toString();
    const raw = await this.call("/payment/create", "POST", body);
    const parsed = createResponse.safeParse(raw);
    if (!parsed.success) throw new FlowProviderError("invalid_response");
    return { flowOrder: parsed.data.flowOrder, token: parsed.data.token, checkoutUrl: this.checkoutUrl(parsed.data.url, parsed.data.token) };
  }

  getStatusByToken(token: string) { return this.status("/payment/getStatus", { token }); }
  getStatusByCommerceId(commerceId: string) { return this.status("/payment/getStatusByCommerceId", { commerceId }); }
  getStatusByFlowOrder(flowOrder: number) { return this.status("/payment/getStatusByFlowOrder", { flowOrder: String(flowOrder) }); }

  private async status(path: string, extra: Record<string, string>): Promise<FlowObservation> {
    const params = { apiKey: this.config.apiKey, ...extra };
    const query = new URLSearchParams({ ...params, s: flowSignature(params, this.config.secretKey) }).toString();
    const parsed = statusResponse.safeParse(await this.call(`${path}?${query}`, "GET"));
    if (!parsed.success) throw new FlowProviderError("invalid_response");
    // Cost stays unknown (null) unless Flow reports a strict non-negative integer; never defaults to 0.
    const feeParsed = feeAmount.safeParse(parsed.data.paymentData?.fee); const fee = feeParsed.success ? feeParsed.data : null;
    return {
      flowOrder: parsed.data.flowOrder, commerceOrder: parsed.data.commerceOrder, statusCode: parsed.data.status, status: mapFlowStatus(parsed.data.status),
      currency: parsed.data.currency, amountClp: parsed.data.amount, feeClp: fee,
    };
  }

  private checkoutUrl(url: string, token: string): string {
    try {
      if (new URL(url).search) throw new FlowProviderError("unsafe_checkout");
      return `${assertSandboxCheckoutOrigin(url)}?token=${encodeURIComponent(token)}`;
    } catch { throw new FlowProviderError("unsafe_checkout"); }
  }

  private async call(pathAndQuery: string, method: "GET" | "POST", body?: string): Promise<unknown> {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.doFetch(`${this.config.apiBase}${pathAndQuery}`, { method, headers: body === undefined ? undefined : { "content-type": "application/x-www-form-urlencoded" }, body, signal: controller.signal, redirect: "error" });
      if (res.status < 200 || res.status >= 300) throw new FlowProviderError("http_error", res.status);
      try { return JSON.parse(await res.text()); } catch { throw new FlowProviderError("invalid_response"); }
    } catch (error) {
      if (error instanceof FlowProviderError) throw error;
      throw new FlowProviderError(controller.signal.aborted ? "timeout" : "network");
    } finally { clearTimeout(timer); }
  }
}
