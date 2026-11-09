"use client";
import type { AuthProvider, AuthSession, CustomerRegistrationInput, RegistrationResult, SignInInput, TechnicianRegistrationInput } from "./auth-provider";
import { getSupabaseBrowserClient } from "@/integrations/supabase/browser-client";
import { accountAccessSchema } from "@/domain/auth/account";

async function authRequest(action: string, input: unknown) {
  const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, input }) });
  const result = await response.json();
  if (!response.ok) {
    if (result.redirect === "/cuenta-no-disponible") window.location.assign(result.redirect);
    throw new Error(result.message ?? "No pudimos completar la solicitud.");
  }
  return result;
}
export class SupabaseAuthProvider implements AuthProvider {
  async signIn(input: SignInInput): Promise<AuthSession> { return (await authRequest("login", input)).session; }
  async getCurrentSession(): Promise<AuthSession | null> {
    const client = getSupabaseBrowserClient();
    const { data: identity, error } = await client.auth.getUser();
    if (error || !identity.user) return null;
    const { data } = await client.rpc("my_account_access");
    const access = accountAccessSchema.safeParse(data);
    if (!access.success || !access.data.allowed) return null;
    return { user: { id: identity.user.id, name: access.data.name, email: identity.user.email ?? "", role: access.data.role }, createdAt: new Date().toISOString() };
  }
  async signOut(): Promise<void> { await authRequest("logout", {}); }
  async registerCustomer(input: CustomerRegistrationInput): Promise<RegistrationResult> { await authRequest("register-customer", input); return { session: null, requiresEmailConfirmation: true }; }
  async registerTechnician(input: TechnicianRegistrationInput): Promise<RegistrationResult> { await authRequest("register-technician", input); return { session: null, requiresEmailConfirmation: true }; }
}
