import {
  type AuthSession,
  type CustomerRegistrationInput,
  type RegistrationResult,
  type SignInInput,
  type TechnicianRegistrationInput,
} from "@/integrations/auth/auth-provider";
import { isDemoModeEnabled } from "@/config/demo-mode";
import { MockAuthProvider } from "@/integrations/auth/mock-auth-provider";
import { SupabaseAuthProvider } from "@/integrations/auth/supabase-auth-provider";

function resolveProvider() {
  return isDemoModeEnabled() ? new MockAuthProvider() : new SupabaseAuthProvider();
}

export class AuthenticationService {
  async signIn(input: SignInInput): Promise<AuthSession> {
    return resolveProvider().signIn(input);
  }

  async getCurrentSession(): Promise<AuthSession | null> {
    return resolveProvider().getCurrentSession();
  }

  async signOut(): Promise<void> {
    return resolveProvider().signOut();
  }

  async registerCustomer(input: CustomerRegistrationInput): Promise<RegistrationResult> {
    return resolveProvider().registerCustomer(input);
  }

  async registerTechnician(input: TechnicianRegistrationInput): Promise<RegistrationResult> {
    return resolveProvider().registerTechnician(input);
  }
}
