import { describe, expect, it } from "vitest";

import { canTransitionEmergency } from "@/domain/enums/emergency-status";

describe("emergency transitions", () => {
  it("created -> matching", () => {
    expect(canTransitionEmergency("created", "matching")).toBe(true);
  });

  it("matching -> broadcasting", () => {
    expect(canTransitionEmergency("matching", "broadcasting")).toBe(true);
  });

  it("broadcasting -> accepted", () => {
    expect(canTransitionEmergency("broadcasting", "accepted")).toBe(true);
  });

  it("accepted -> technician_en_route", () => {
    expect(canTransitionEmergency("accepted", "technician_en_route")).toBe(true);
  });

  it("technician_en_route -> arrived", () => {
    expect(canTransitionEmergency("technician_en_route", "arrived")).toBe(true);
  });

  it("arrived -> in_progress", () => {
    expect(canTransitionEmergency("arrived", "in_progress")).toBe(true);
  });

  it("in_progress -> completed", () => {
    expect(canTransitionEmergency("in_progress", "completed")).toBe(true);
  });

  it("rejects completed -> in_progress", () => {
    expect(canTransitionEmergency("completed", "in_progress")).toBe(false);
  });

  it("rejects cancelled -> broadcasting", () => {
    expect(canTransitionEmergency("cancelled", "broadcasting")).toBe(false);
  });

  it("rejects expired -> accepted", () => {
    expect(canTransitionEmergency("expired", "accepted")).toBe(false);
  });

  it("rejects created -> completed", () => {
    expect(canTransitionEmergency("created", "completed")).toBe(false);
  });
});
