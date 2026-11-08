import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { isDemoModeEnabled } from "@/config/demo-mode";
import type { UserRole } from "@/domain/enums/roles";
import type { AuthenticatedUser } from "@/integrations/auth/auth-provider";
import { DEMO_SESSION_COOKIE, decodeDemoSession } from "@/integrations/auth/demo-session-cookie";
import { getSupabaseServerClient } from "@/integrations/supabase/server-client";

async function getDemoAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  return decodeDemoSession(cookieStore.get(DEMO_SESSION_COOKIE)?.value);
}

export async function getServerAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  if (isDemoModeEnabled()) return getDemoAuthenticatedUser();

  const supabase = await getSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user || !userData.user.email) return null;

  const { data: profile, error } = await supabase.from("profiles").select("full_name, role").eq("id", userData.user.id).maybeSingle();
  if (error || !profile) return null;

  const role = profile.role;
  if (role !== "customer" && role !== "technician" && role !== "moderator" && role !== "superadmin") return null;

  return { id: userData.user.id, name: profile.full_name, email: userData.user.email, role };
}

export async function requireServerRole(roles: readonly UserRole[]): Promise<AuthenticatedUser | null> {
  const user = await getServerAuthenticatedUser();
  if (!user || !roles.includes(user.role)) redirect("/login");
  return user;
}
