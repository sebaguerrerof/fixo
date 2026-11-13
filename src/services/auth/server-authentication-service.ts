import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { cache } from "react";

import { isDemoModeEnabled } from "@/config/demo-mode";
import { assertServerEnvironment } from "@/config/server-environment";
import type { UserRole } from "@/domain/enums/roles";
import type { AuthenticatedUser } from "@/integrations/auth/auth-provider";
import { DEMO_SESSION_COOKIE, decodeDemoSession } from "@/integrations/auth/demo-session-cookie";
import { getSupabaseServerClient } from "@/integrations/supabase/server-client";
import { accountAccessSchema } from "@/domain/auth/account";

async function getDemoAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  return decodeDemoSession(cookieStore.get(DEMO_SESSION_COOKIE)?.value);
}

// React memoizes within one server render only. Mutations and new requests reauthorize afresh.
export const getServerAuthenticatedUser = cache(async function getServerAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  assertServerEnvironment();
  if (isDemoModeEnabled()) return getDemoAuthenticatedUser();

  const supabase = await getSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user || !userData.user.email) return null;

  const { data, error } = await supabase.rpc("my_account_access");
  const profile = accountAccessSchema.safeParse(data);
  if (error || !profile.success) return null;
  if (!profile.data.allowed) redirect("/cuenta-no-disponible");
  return { id: userData.user.id, name: profile.data.name, email: userData.user.email, role: profile.data.role };
});

export async function requireServerRole(roles: readonly UserRole[]): Promise<AuthenticatedUser> {
  const user = await getServerAuthenticatedUser();
  if (!user || !roles.includes(user.role)) redirect("/login");
  return user;
}
