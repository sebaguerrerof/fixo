import { AuthCard } from "@/components/auth/auth-card";
import { LogoutButton } from "@/components/auth/logout-button";
import { getSupabaseServerClient } from "@/integrations/supabase/server-client";
export const dynamic = "force-dynamic";
export default async function AccountUnavailablePage() {
  let status = "unavailable";
  try { const client = await getSupabaseServerClient(); const { data: user } = await client.auth.getUser(); if (user.user) { const { data } = await client.rpc("my_account_access"); status = data?.account_status ?? status; } } catch { /* no internal detail */ }
  return <AuthCard title={status === "suspended" ? "Cuenta suspendida" : status === "blocked" ? "Cuenta bloqueada" : "Acceso no habilitado"} description="Esta cuenta no puede realizar operaciones. Si tienes una invitación pendiente, utiliza el enlace enviado a tu correo. Si interrumpiste el proceso, solicita recuperación desde Ingresar. Para revisar una suspensión, contacta al equipo de Fixo."><LogoutButton /></AuthCard>;
}
