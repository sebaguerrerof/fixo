import { createHash } from "node:crypto";

type Env = Readonly<Record<string, string | undefined>>;
const HEADER_NAME = /^[a-z0-9-]{1,64}$/;

/**
 * Opaque rate-limit subject for the caller's network origin. Only the header named in FIXO_TRUSTED_IP_HEADER is honoured
 * (e.g. `x-vercel-forwarded-for` behind Vercel, which overwrites it); client-supplied headers such as a raw X-Forwarded-For are never trusted.
 * Without a configured header every caller shares one strict bucket (fails closed) instead of trusting a spoofable value.
 * The raw IP is never stored or logged: only a salted-by-scope hash.
 */
export function rateLimitSubjectForRequest(headers: Pick<Headers, "get">, env: Env = process.env): string {
  const name = env.FIXO_TRUSTED_IP_HEADER?.trim().toLowerCase();
  const raw = name && HEADER_NAME.test(name) ? headers.get(name)?.split(",")[0]?.trim() : undefined;
  if (!raw || raw.length > 64 || !/^[0-9a-fA-F:.]+$/.test(raw)) return "ip:unknown";
  return "ip:" + createHash("sha256").update("fixo-payment-rl:" + raw.toLowerCase()).digest("hex").slice(0, 32);
}
