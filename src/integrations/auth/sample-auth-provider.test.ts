import { describe, expect, it } from "vitest";

import { SampleAuthProvider } from "@/integrations/auth/sample-auth-provider";

describe("SampleAuthProvider", () => {
  it("authenticates the customer example account", async () => {
    const session = await new SampleAuthProvider().signIn({
      email: "cliente@fixo.cl",
      password: "fixo2026",
    });

    expect(session.user.role).toBe("customer");
    expect(session.user.name).toBe("Antonia Pérez");
  });

  it("rejects an invalid password", async () => {
    await expect(new SampleAuthProvider().signIn({
      email: "cliente@fixo.cl",
      password: "password-invalida",
    })).rejects.toThrow("Revisa tu correo y contraseña.");
  });
});
