import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "./config";
import { isDemoModeEnabled } from "@/config/demo-mode";

/** Only Auth delivery, flow proofs and rate limits use this client. Never user data/RLS queries. */
export function getSupabaseAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (isDemoModeEnabled() || !key) throw new Error("Configuración de autenticación no disponible.");
  return createClient(getSupabasePublicConfig().url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}
