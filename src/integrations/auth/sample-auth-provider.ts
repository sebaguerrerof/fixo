import { signInInputSchema, type AuthProvider } from "@/integrations/auth/auth-provider";

const examplePassword = "fixo2026";

const sampleAccounts = [
  { id: "customer-sample", name: "Antonia Pérez", email: "cliente@fixo.cl", role: "customer" as const },
  { id: "technician-sample", name: "Camila Rojas", email: "tecnico@fixo.cl", role: "technician" as const },
  { id: "admin-sample", name: "María Admin", email: "admin@fixo.cl", role: "superadmin" as const },
] as const;

export class SampleAuthProvider implements AuthProvider {
  async signIn(rawInput: unknown) {
    const input = signInInputSchema.parse(rawInput);
    const account = sampleAccounts.find((candidate) => candidate.email === input.email.toLocaleLowerCase("es-CL"));

    if (!account || input.password !== examplePassword) {
      throw new Error("Revisa tu correo y contraseña.");
    }

    return {
      user: account,
      createdAt: new Date().toISOString(),
    };
  }
}
