import { describe, it, expect } from "vitest";
import { jobCommandSchema, jobRpcPayload } from "./job-command";
const meta = { jobId: "6b2fa622-1998-45d4-b50c-025aa50a8ffc", operationId: "f27330cf-184a-4ef4-bca5-6f5b0fdf4637", expectedRevision: 2 };
describe("job command boundary", () => {
  it("rejects browser status, pilot and editable financial fields", () => {
    for (const payload of [{ status: "completed" }, { mode: "authorized_pilot" }, { amount: 1 }]) expect(jobCommandSchema.safeParse({ ...meta, command: { action: "start", payload } }).success).toBe(false);
    expect(jobCommandSchema.safeParse({ ...meta, command: { action: "enable_pilot", payload: {} } }).success).toBe(false);
  });
  it("requires reason and expected revision", () => {
    expect(jobCommandSchema.safeParse({ ...meta, expectedRevision: 0, command: { action: "request_cancellation", payload: { reason: "x" } } }).success).toBe(false);
  });
  it("converts a future Santiago interval and rejects inverted windows", () => {
    expect(jobRpcPayload({ action: "propose_schedule", payload: { date: "2099-11-10", startTime: "10:00", endTime: "12:00", reason: "" } }).startsAt).toMatch(/T13:00/);
    expect(() => jobRpcPayload({ action: "propose_schedule", payload: { date: "2099-11-10", startTime: "12:00", endTime: "10:00", reason: "" } })).toThrow("franja");
  });
});
