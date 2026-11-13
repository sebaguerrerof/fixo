import { describe, expect, it } from "vitest";
import { canTransitionJob } from "@/domain/enums/job-status";

describe("job transitions", () => {
  it.each(["scheduled", "in_progress", "completed"] as const)("does not execute an awarded job as %s before payment/pilot approval", next => {
    expect(canTransitionJob("awarded", next)).toBe(false);
  });
  it("moves a technician from en route to arrived", () => {
    expect(canTransitionJob("technician_en_route", "arrived")).toBe(true);
  });

  it("does not complete cancelled work", () => {
    expect(canTransitionJob("cancelled", "completed")).toBe(false);
  });
});
