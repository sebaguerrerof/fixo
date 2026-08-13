import { describe, expect, it } from "vitest";
import { canTransitionServiceRequest } from "@/domain/enums/service-request-status";

describe("service request transitions", () => {
  it("allows the happy path into matching", () => {
    expect(canTransitionServiceRequest("submitted", "matching")).toBe(true);
  });

  it("rejects reopening a completed request", () => {
    expect(canTransitionServiceRequest("completed", "in_progress")).toBe(false);
  });
});
