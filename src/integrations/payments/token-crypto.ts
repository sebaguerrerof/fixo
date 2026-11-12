import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/** AES-256-GCM for checkout/callback tokens at rest. Key lives only in server env, separate from DB content. */
export interface TokenKey { readonly id: string; readonly key: Buffer }

export function loadTokenKey(env: Readonly<Record<string, string | undefined>> = process.env): TokenKey {
  const id = env.FIXO_PAYMENT_TOKEN_KEY_ID?.trim(), raw = env.FIXO_PAYMENT_TOKEN_KEY?.trim();
  if (!id || id.length > 64 || !raw) throw new Error("Clave de cifrado de tokens de pago no configurada.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("La clave de cifrado de tokens debe ser de 32 bytes en base64.");
  return { id, key };
}

/** Layout: iv(12) | tag(16) | ciphertext. `context` (e.g. the attempt id) is authenticated so a blob cannot be moved between rows. */
export function encryptToken(plain: string, context: string, tokenKey: TokenKey = loadTokenKey()): { readonly ciphertext: Buffer; readonly keyId: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tokenKey.key, iv); cipher.setAAD(Buffer.from(context, "utf8"));
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return { ciphertext: Buffer.concat([iv, cipher.getAuthTag(), body]), keyId: tokenKey.id };
}

export function decryptToken(blob: Buffer, keyId: string, context: string, tokenKey: TokenKey = loadTokenKey()): string {
  if (keyId !== tokenKey.id) throw new Error("Clave de cifrado desconocida.");
  if (blob.length < 29) throw new Error("Token cifrado inválido.");
  const decipher = createDecipheriv("aes-256-gcm", tokenKey.key, blob.subarray(0, 12)); decipher.setAAD(Buffer.from(context, "utf8")); decipher.setAuthTag(blob.subarray(12, 28));
  return Buffer.concat([decipher.update(blob.subarray(28)), decipher.final()]).toString("utf8");
}
