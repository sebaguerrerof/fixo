import { LogoutButton } from "@/components/auth/logout-button";
import { ProfileForm, type OwnProfile } from "@/components/auth/profile-form";
import { EmptyState } from "@/components/shared/empty-state";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { TextLink } from "@/components/ui/text-link";
import { dashboardForRole } from "@/integrations/auth/auth-provider";
import { getSupabaseServerClient } from "@/integrations/supabase/server-client";
import { requireServerRole } from "@/services/auth/server-authentication-service";

export const metadata = { title: "Mi perfil" };

export default async function ProfilePage() {
  const user = await requireServerRole(["customer", "technician", "moderator", "superadmin"]);
  let profile: OwnProfile | null = null;
  let categories: { id: string; name: string }[] = [];
  try {
    const client = await getSupabaseServerClient();
    const [own, rubros] = await Promise.all([client.rpc("my_profile"), client.from("categories").select("id,name").order("name")]);
    if (!own.error) profile = own.data;
    if (!rubros.error) categories = rubros.data ?? [];
  } catch { /* controlled unavailable */ }
  return (
    <main className="min-h-screen bg-muted/40 px-4 py-6 sm:py-8">
      <div className="mx-auto max-w-3xl">
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <Logo />
          <div className="flex items-center gap-2 sm:gap-4"><TextLink href={dashboardForRole(user!.role)}>Mi panel</TextLink><ThemeToggle /><LogoutButton /></div>
        </header>
        <section className="mt-6 rounded-3xl border border-border bg-background p-5 sm:mt-8 sm:p-8">
          <h1 className="mb-7 text-2xl font-semibold tracking-tight sm:text-3xl">Mi perfil</h1>
          {profile ? <ProfileForm categories={categories} profile={profile} /> : <EmptyState description="No pudimos consultar tus datos. Inténtalo más tarde." title="Perfil no disponible" />}
        </section>
      </div>
    </main>
  );
}
