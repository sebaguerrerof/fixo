"use client";

import type {
  AuthProvider,
  AuthSession,
  CustomerRegistrationInput,
  RegistrationResult,
  SignInInput,
  TechnicianRegistrationInput,
} from "@/integrations/auth/auth-provider";
import { DEMO_SESSION_COOKIE, decodeDemoSession, encodeDemoSession } from "@/integrations/auth/demo-session-cookie";
import { DEMO_ACCOUNTS } from "@/repositories/mock/fixtures/demo-accounts";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function readCookie(name: string): string | undefined {
  return document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function writeSessionCookie(user: AuthSession["user"]): void {
  document.cookie = `${DEMO_SESSION_COOKIE}=${encodeDemoSession(user)}; path=/; max-age=${SESSION_MAX_AGE_SECONDS}`;
}

export class MockAuthProvider implements AuthProvider {
  async signIn(input: SignInInput): Promise<AuthSession> {
    const account = DEMO_ACCOUNTS.find((candidate) => candidate.email.toLowerCase() === input.email.trim().toLowerCase());
    if (!account) throw new Error("No encontramos una cuenta demo con ese correo. Usa uno de los accesos rápidos.");
    writeSessionCookie(account);
    return { user: account, createdAt: new Date().toISOString() };
  }

  async getCurrentSession(): Promise<AuthSession | null> {
    const user = decodeDemoSession(readCookie(DEMO_SESSION_COOKIE));
    return user ? { user, createdAt: new Date().toISOString() } : null;
  }

  async signOut(): Promise<void> {
    document.cookie = `${DEMO_SESSION_COOKIE}=; path=/; max-age=0`;
  }

  async registerCustomer(input: CustomerRegistrationInput): Promise<RegistrationResult> {
    const user: AuthSession["user"] = { id: `demo-customer-${Date.now()}`, name: input.fullName, email: input.email, role: "customer" };
    writeSessionCookie(user);
    return { session: { user, createdAt: new Date().toISOString() }, requiresEmailConfirmation: false };
  }

  async registerTechnician(input: TechnicianRegistrationInput): Promise<RegistrationResult> {
    const user: AuthSession["user"] = { id: `demo-technician-${Date.now()}`, name: input.fullName, email: input.email, role: "technician" };
    writeSessionCookie(user);
    return { session: { user, createdAt: new Date().toISOString() }, requiresEmailConfirmation: false };
  }
}
