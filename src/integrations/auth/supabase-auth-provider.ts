"use client";

import type { User } from "@supabase/supabase-js";

import {
  type AuthProvider,
  type AuthSession,
  type CustomerRegistrationInput,
  type RegistrationResult,
  type SignInInput,
  type TechnicianRegistrationInput,
} from "@/integrations/auth/auth-provider";
import { getSupabaseBrowserClient } from "@/integrations/supabase/browser-client";

function readableAuthError(message: string): string {
  if (message.toLowerCase().includes("invalid login credentials")) return "Revisa tu correo y contraseña.";
  if (message.toLowerCase().includes("already registered")) return "Ya existe una cuenta con este correo.";
  return message;
}

function profileName(user: User, profile: Record<string, unknown> | null): string {
  if (typeof profile?.full_name === "string") return profile.full_name;
  if (typeof user.user_metadata.full_name === "string") return user.user_metadata.full_name;
  return user.email?.split("@").at(0) ?? "Cuenta Fixo";
}

function profileRole(profile: Record<string, unknown> | null): AuthSession["user"]["role"] {
  const role = profile?.role;
  return role === "technician" || role === "moderator" || role === "superadmin" ? role : "customer";
}

export class SupabaseAuthProvider implements AuthProvider {
  async signIn(input: SignInInput): Promise<AuthSession> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signInWithPassword(input);
    if (error) throw new Error(readableAuthError(error.message));
    if (!data.user) throw new Error("No pudimos iniciar la sesión.");

    const session = await this.getCurrentSession();
    if (!session) throw new Error("No pudimos cargar tu perfil de acceso.");
    return session;
  }

  async getCurrentSession(): Promise<AuthSession | null> {
    const supabase = getSupabaseBrowserClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return null;

    const { data: profile, error: profileError } = await supabase.from("profiles").select("full_name, role").eq("id", userData.user.id).maybeSingle();
    if (profileError) throw new Error("No pudimos cargar tu perfil de acceso.");

    return {
      user: {
        id: userData.user.id,
        name: profileName(userData.user, profile),
        email: userData.user.email ?? "",
        role: profileRole(profile),
      },
      createdAt: new Date().toISOString(),
    };
  }

  async signOut(): Promise<void> {
    const { error } = await getSupabaseBrowserClient().auth.signOut();
    if (error) throw new Error("No pudimos cerrar tu sesión.");
  }

  async registerCustomer(input: CustomerRegistrationInput): Promise<RegistrationResult> {
    return this.signUp(input.email, input.password, { full_name: input.fullName, account_type: "customer" });
  }

  async registerTechnician(input: TechnicianRegistrationInput): Promise<RegistrationResult> {
    return this.signUp(input.email, input.password, {
      full_name: input.fullName,
      account_type: "technician",
      city: input.city,
      coverage_areas: input.coverageAreas.split(",").map((area) => area.trim()).filter(Boolean),
      headline: input.headline,
      bio: input.bio,
      category_ids: input.categoryIds,
      specialties: input.specialties.split(",").map((specialty) => specialty.trim()).filter(Boolean),
      years_of_experience: input.yearsOfExperience,
      emergency_enabled: input.emergencyEnabled,
      starting_price_clp: input.startingPriceClp,
    });
  }

  private async signUp(email: string, password: string, metadata: Record<string, unknown>): Promise<RegistrationResult> {
    const { data, error } = await getSupabaseBrowserClient().auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    if (error) throw new Error(readableAuthError(error.message));

    return {
      session: data.session ? await this.getCurrentSession() : null,
      requiresEmailConfirmation: !data.session,
    };
  }
}
