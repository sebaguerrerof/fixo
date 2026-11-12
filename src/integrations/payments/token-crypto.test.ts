import { describe, it, expect, vi } from "vitest";
import { randomBytes } from "node:crypto";
vi.mock("server-only", () => ({}));
import { encryptToken, decryptToken, loadTokenKey } from "./token-crypto";

const key = { id: "k1", key: randomBytes(32) };
describe("token-crypto", () => {
  it("round-trips and does not expose the plaintext", () => {
    const { ciphertext, keyId } = encryptToken("TOKEN-ñ", "attempt-1", key);
    expect(keyId).toBe("k1"); expect(ciphertext.toString("utf8")).not.toContain("TOKEN");
    expect(decryptToken(ciphertext, keyId, "attempt-1", key)).toBe("TOKEN-ñ");
  });
  it("uses a fresh IV each time", () => {
    expect(encryptToken("x", "c", key).ciphertext.equals(encryptToken("x", "c", key).ciphertext)).toBe(false);
  });
  it("rejects wrong context, tampering, wrong key id and truncation", () => {
    const { ciphertext } = encryptToken("x", "a", key);
    expect(() => decryptToken(ciphertext, "k1", "b", key)).toThrow();
    const bad = Buffer.from(ciphertext); bad[bad.length - 1] ^= 1;
    expect(() => decryptToken(bad, "k1", "a", key)).toThrow();
    expect(() => decryptToken(ciphertext, "k2", "a", key)).toThrow();
    expect(() => decryptToken(ciphertext.subarray(0, 10), "k1", "a", key)).toThrow();
  });
  it("validates configuration", () => {
    expect(() => loadTokenKey({})).toThrow();
    expect(() => loadTokenKey({ FIXO_PAYMENT_TOKEN_KEY_ID: "k", FIXO_PAYMENT_TOKEN_KEY: Buffer.alloc(16).toString("base64") })).toThrow();
    expect(loadTokenKey({ FIXO_PAYMENT_TOKEN_KEY_ID: "k", FIXO_PAYMENT_TOKEN_KEY: randomBytes(32).toString("base64") }).id).toBe("k");
  });
});
