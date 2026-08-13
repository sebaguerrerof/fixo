import { describe, expect, it } from "vitest";

import { canTransitionTechnician } from "@/domain/enums/technician-status";

describe("technician status transitions", () => {
  it("allows a reviewed profile to become active", () => {
    expect(canTransitionTechnician("verified", "active")).toBe(true);
  });

  it("does not allow a banned profile to be reactivated", () => {
    expect(canTransitionTechnician("banned", "active")).toBe(false);
  });
});
