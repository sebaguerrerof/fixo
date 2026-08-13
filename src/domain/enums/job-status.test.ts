import { describe, expect, it } from "vitest";
import { canTransitionJob } from "@/domain/enums/job-status";

describe("job transitions", () => {
  it("moves a technician from en route to arrived", () => {
    expect(canTransitionJob("technician_en_route", "arrived")).toBe(true);
  });

  it("does not complete cancelled work", () => {
    expect(canTransitionJob("cancelled", "completed")).toBe(false);
  });
});
