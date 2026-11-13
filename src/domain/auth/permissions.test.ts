import { describe, expect, it } from "vitest";
import { hasPermission } from "./permissions";

describe("permission foundation", () => {
  it.each(["customer", "technician", "moderator"] as const)("never lets %s assign privileged roles or invite administrators", (role) => {
    expect(hasPermission(role, "user:assign_privileged_role")).toBe(false);
    expect(hasPermission(role, "user:invite_administrator")).toBe(false);
  });
  it("allows operational technician review without granting privileged-role administration", () => {
    expect(hasPermission("moderator", "technician:review")).toBe(true);
    expect(hasPermission("superadmin", "user:assign_privileged_role")).toBe(true);
    expect(hasPermission("customer", "document:read_all")).toBe(false);
  });
});
