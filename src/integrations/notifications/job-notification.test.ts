import { describe, it, expect } from "vitest";
import { mkdtemp, readFile, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
// The same adapter module is executed by the native worker and integration runner.
// @ts-expect-error Node worker module has no TypeScript declaration.
import { captureJobNotification, processJobNotification } from "../../../scripts/lib/job-notification.mjs";
const id = "750fb9a9-c315-4835-97f1-cb501cf2bd75", item = { id, job_id: id, recipient_id: id, lease_token: id, template: "start", destination: "private@example.invalid", address: "private", note: "private incident" };
describe("notification capture boundary", () => {
  it("captures idempotently without PII and never claims delivery", async () => {
    const directory = await mkdtemp(join(tmpdir(), "fixo-notification-"));
    try {
      const options = { directory, allowedRecipients: new Set([id]) };
      expect(await captureJobNotification(item, options)).toBe(await captureJobNotification(item, options));
      const text = await readFile(join(directory, id + ".json"), "utf8"); expect(text).not.toContain("private"); expect(JSON.parse(text).delivery).toBe("captured_only");
      await expect(captureJobNotification({ ...item, recipient_id: "other" }, options)).rejects.toThrow();
    } finally { await unlink(join(directory, id + ".json")); await rmdir(directory); }
  });
  it("accepts Sprint 05 payment/extra-charge templates and rejects unknown ones", async () => {
    const directory = await mkdtemp(join(tmpdir(), "fixo-notification-"));
    const templates = ["extra_charge_proposed", "extra_charge_accepted", "extra_charge_rejected", "payment_confirmed", "payment_rejected", "payment_cancelled", "payment_review_required"];
    const options = { directory, allowedRecipients: new Set([id]) };
    try {
      for (const template of templates) {
        const text = await captureJobNotification({ ...item, template }, options);
        expect(text).toMatch(/^capture:[0-9a-f]{64}$/);
        const body = await readFile(join(directory, id + ".json"), "utf8");
        expect(body).not.toContain("private"); expect(body).not.toMatch(/\d{3}\.\d{3}|\$/);
        await unlink(join(directory, id + ".json"));
      }
      await expect(captureJobNotification({ ...item, template: "payment_paid_out" }, options)).rejects.toThrow("capture_not_authorized");
    } finally { await rmdir(directory); }
  });
  it("records retry when capture/provider is unavailable", async () => {
    const calls: unknown[] = [], client = { rpc: async (name: string, args: unknown) => { calls.push({ name, args }); return name === "claim_job_notification" ? { data: item, error: null } : { error: null }; } };
    await processJobNotification(client, { allowedRecipients: new Set() }); expect(calls[1]).toMatchObject({ args: { outcome: "retry", provider_reference: null } });
  });
});
