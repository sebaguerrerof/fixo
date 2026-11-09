import Link from "next/link";
import { requireServerRole } from "@/services/auth/server-authentication-service";
import { getSupabaseServerClient } from "@/integrations/supabase/server-client";
import { dashboardForRole } from "@/integrations/auth/auth-provider";
import { ProfileForm,type OwnProfile } from "@/components/auth/profile-form";
import { EmptyState } from "@/components/shared/empty-state";
import { Logo } from "@/components/shared/logo";
import { LogoutButton } from "@/components/auth/logout-button";
export default async function ProfilePage(){
  const user=await requireServerRole(["customer","technician","moderator","superadmin"]);let profile:OwnProfile|null=null;let categories:{id:string;name:string}[]=[];
  try{const client=await getSupabaseServerClient();const [own,rubros]=await Promise.all([client.rpc("my_profile"),client.from("categories").select("id,name").order("name")]);if(!own.error)profile=own.data;if(!rubros.error)categories=rubros.data??[];}catch{/* controlled unavailable */}
  return <main className="min-h-screen bg-muted/40 px-4 py-8"><div className="mx-auto max-w-3xl"><header className="flex flex-wrap items-center justify-between gap-4"><Logo/><div className="flex items-center gap-4"><Link className="text-sm font-semibold text-primary underline" href={dashboardForRole(user!.role)}>Mi panel</Link><LogoutButton/></div></header><section className="mt-8 rounded-3xl border bg-background p-6 sm:p-8"><h1 className="mb-7 text-3xl font-bold">Mi perfil</h1>{profile?<ProfileForm profile={profile} categories={categories}/>:<EmptyState title="Perfil no disponible" description="No pudimos consultar tus datos. Inténtalo más tarde."/>}</section></div></main>;
}
