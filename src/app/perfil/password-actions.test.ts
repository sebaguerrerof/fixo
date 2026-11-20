import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ signIn: vi.fn(), update: vi.fn(), signOut: vi.fn(), role: vi.fn(), demo: vi.fn() }));
vi.mock("@/integrations/supabase/server-client", () => ({ getSupabaseServerClient: async () => ({ auth: { signInWithPassword: mocks.signIn, updateUser: mocks.update, signOut: mocks.signOut } }) }));
vi.mock("@/services/auth/server-authentication-service", () => ({ requireServerRole: mocks.role }));
vi.mock("@/config/demo-mode", () => ({ isDemoModeEnabled: mocks.demo }));

import { changePasswordAction } from "./password-actions";

const valid = { currentPassword: "Actual-clave-123", password: "Nueva-clave-4567", confirmPassword: "Nueva-clave-4567" };
beforeEach(() => {
  mocks.demo.mockReturnValue(false);
  mocks.role.mockResolvedValue({ id: "u1", name: "Ana", email: "ana@ejemplo.cl", role: "customer" });
  mocks.signIn.mockResolvedValue({ error: null });
  mocks.update.mockResolvedValue({ error: null });
  mocks.signOut.mockResolvedValue({ error: null });
});
afterEach(() => vi.resetAllMocks());

describe("changePasswordAction", () => {
  it("verifies the current password, sets the new one, then revokes only the other sessions, in that order", async () => {
    const order: string[] = [];
    mocks.signIn.mockImplementation(async () => { order.push("verify"); return { error: null }; });
    mocks.update.mockImplementation(async () => { order.push("update"); return { error: null }; });
    mocks.signOut.mockImplementation(async () => { order.push("revoke"); return { error: null }; });
    expect(await changePasswordAction(valid)).toMatchObject({ ok: true });
    expect(order).toEqual(["verify", "update", "revoke"]);
    expect(mocks.signIn).toHaveBeenCalledWith({ email: "ana@ejemplo.cl", password: valid.currentPassword });
    expect(mocks.update).toHaveBeenCalledWith({ password: valid.password });
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "others" });
  });

  it("does not change anything when the current password is wrong", async () => {
    mocks.signIn.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    expect(await changePasswordAction(valid)).toEqual({ ok: false, message: "La contraseña actual no es correcta." });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it.each([
    ["confirmation differs", { ...valid, confirmPassword: "Otra-clave-45678" }],
    ["new equals current", { ...valid, password: valid.currentPassword, confirmPassword: valid.currentPassword }],
    ["new is weak", { ...valid, password: "corta", confirmPassword: "corta" }],
    ["current is empty", { ...valid, currentPassword: "" }],
    ["input is not an object", null],
  ])("rejects before touching the auth provider when %s", async (_label, input) => {
    expect((await changePasswordAction(input)).ok).toBe(false);
    expect(mocks.signIn).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("is not available in demo mode", async () => {
    mocks.demo.mockReturnValue(true);
    expect((await changePasswordAction(valid)).ok).toBe(false);
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("reports a failed update without claiming success or revoking sessions", async () => {
    mocks.update.mockResolvedValue({ error: { message: "x" } });
    expect((await changePasswordAction(valid)).ok).toBe(false);
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("is honest when the password changed but the other sessions could not be closed", async () => {
    mocks.signOut.mockResolvedValue({ error: { message: "x" } });
    const result = await changePasswordAction(valid);
    expect(result.ok).toBe(true);
    expect(result.message).toContain("no pudimos cerrar");
  });

  it("never echoes a secret back", async () => {
    mocks.update.mockRejectedValue(new Error(`boom ${valid.password}`));
    const result = await changePasswordAction(valid);
    expect(JSON.stringify(result)).not.toContain(valid.password);
    expect(JSON.stringify(result)).not.toContain(valid.currentPassword);
  });
});
