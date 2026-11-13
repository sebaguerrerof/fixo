import { withDeadline } from "./deadline";
import type { PaymentRateLimiter, RateLimitScope } from "@/repositories/contracts/payment-repository";

/** Persistent limits (PostgreSQL fixed windows). Idempotency and provider verification remain separate defences. */
export const CHECKOUT_LIMIT = { scope: "checkout_user", max: 10, windowSeconds: 600 } as const;
export const CALLBACK_LIMIT = { scope: "callback_ip", max: 120, windowSeconds: 60 } as const;

export class PaymentRateLimitedError extends Error {
  constructor(readonly retryAfterSeconds: number) { super("Demasiados intentos de pago. Espera unos minutos antes de intentar nuevamente."); this.name = "PaymentRateLimitedError"; }
}
/** The limiter itself failed: callers must fail closed (never skip the limit). */
export class PaymentRateLimiterUnavailableError extends Error { constructor() { super("No pudimos verificar el límite de frecuencia."); this.name = "PaymentRateLimiterUnavailableError"; } }

export async function enforceRateLimit(limiter: PaymentRateLimiter, limit: { readonly scope: RateLimitScope; readonly max: number; readonly windowSeconds: number }, subject: string, signal?: AbortSignal): Promise<void> {
  let decision;
  try { const call = signal ? limiter.hit(limit.scope, subject, limit.max, limit.windowSeconds, signal) : limiter.hit(limit.scope, subject, limit.max, limit.windowSeconds); decision = await (signal ? withDeadline(signal, call) : call); } catch { throw new PaymentRateLimiterUnavailableError(); }
  if (!decision.allowed) throw new PaymentRateLimitedError(decision.retryAfterSeconds);
}
