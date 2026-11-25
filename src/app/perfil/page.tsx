import type { ReactNode } from "react";

import { AdminDashboardShell } from "@/components/admin/admin-dashboard-shell";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { ProfileForm, type OwnProfile } from "@/components/auth/profile-form";
import { EmptyState } from "@/components/shared/empty-state";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { TechnicianDashboardShell } from "@/components/technicians/technician-dashboard-shell";
import type { UserRole } from "@/domain/enums/roles";
import { customerNavigation } from "@/features/customer/customer-navigation";
import { getSupabaseServerClient } from "@/integrations/supabase/server-client";
import { requireServerRole } from "@/services/auth/server-authentication-service";

export const metadata = { title: "Mi perfil" };

export default async function ProfilePage() {
  const user = await requireServerRole(["customer", "technician", "moderator", "superadmin"]);
  let profile: OwnProfile | null = null;
  try {
    const client = await getSupabaseServerClient();
    const own = await client.rpc("my_profile");
    if (!own.error) profile = own.data;
  } catch { /* controlled unavailable */ }
  return (
    <ProfileShell role={user!.role} userName={user!.name}>
      <PageHeader description="Tus datos de contacto. El correo y el rol los gestiona la plataforma." title="Mi perfil" />
      <div className="mt-8 max-w-3xl">
        {profile
          ? <section className="rounded-lg border border-border bg-card p-5 sm:p-8"><ProfileForm profile={profile} /></section>
          : <EmptyState description="No pudimos consultar tus datos. Inténtalo más tarde." title="Perfil no disponible" />}
      </div>
      <section className="mt-6 max-w-3xl rounded-lg border border-border bg-card p-5 sm:p-8">
        <h2 className="text-2xl">Cambiar contraseña</h2>
        <p className="mb-5 mt-2 text-sm text-muted-foreground">Te pediremos la contraseña actual. Al cambiarla cerramos tus otras sesiones; esta sigue abierta.</p>
        <ChangePasswordForm />
      </section>
    </ProfileShell>
  );
}

/** The account page lives inside the panel of the signed-in role, so editing it never drops the role's navigation. */
function ProfileShell({ role, userName, children }: { readonly role: UserRole; readonly userName: string; readonly children: ReactNode }) {
  if (role === "technician") return <TechnicianDashboardShell activeHref="/perfil">{children}</TechnicianDashboardShell>;
  if (role === "customer") return <DashboardShell activeHref="/perfil" navigation={customerNavigation} requiredRole="customer" roleLabel="Espacio cliente" userName={userName}>{children}</DashboardShell>;
  return <AdminDashboardShell activeHref="/perfil">{children}</AdminDashboardShell>;
}
