import "server-only";
import { createHmac } from "node:crypto";

/**
 * Flow signs outgoing requests only: every parameter except `s`, sorted by name,
 * concatenated as name+value (raw, before URL encoding), HMAC-SHA256 hex with the secret key.
 * The incoming confirmation callback carries no signature; it is an untrusted trigger.
 */
export function flowSignature(params: Readonly<Record<string, string>>, secretKey: string): string {
  if (!secretKey) throw new Error("Clave secreta Flow ausente.");
  const payload = Object.keys(params).filter((k) => k !== "s").sort().map((k) => `${k}${params[k]}`).join("");
  return createHmac("sha256", secretKey).update(payload, "utf8").digest("hex");
}
