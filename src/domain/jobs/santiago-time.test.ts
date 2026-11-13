import { describe, it, expect } from "vitest";
import { resolveSantiagoInstant, santiagoInstants } from "./santiago-time";
describe("Santiago wall time", () => {
  it("handles summer and winter without a fixed offset", () => {
    expect(resolveSantiagoInstant("2026-11-10", "10:30")).toBe("2026-11-10T13:30:00.000Z");
    expect(resolveSantiagoInstant("2026-07-10", "10:30")).toBe("2026-07-10T14:30:00.000Z");
  });
  it("rejects the daylight saving gap and invalid dates", () => {
    expect(santiagoInstants("2026-09-06", "00:30")).toEqual([]);
    expect(() => resolveSantiagoInstant("2026-09-06", "00:30")).toThrow("no existe");
    expect(santiagoInstants("2026-02-30", "12:00")).toEqual([]);
  });
  it("requires an explicit occurrence during the overlap", () => {
    expect(santiagoInstants("2026-04-04", "23:30")).toEqual(["2026-04-05T02:30:00.000Z", "2026-04-05T03:30:00.000Z"]);
    expect(() => resolveSantiagoInstant("2026-04-04", "23:30")).toThrow("se repite");
    expect(resolveSantiagoInstant("2026-04-04", "23:30", "second")).toBe("2026-04-05T03:30:00.000Z");
  });
});
