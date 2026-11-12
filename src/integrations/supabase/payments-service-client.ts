import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "./config";
import { isDemoModeEnabled } from "@/config/demo-mode";
import { assertAuthorizedPaymentsTarget } from "@/integrations/payments/payments-target";

/**
 * Narrow privileged client: ONLY for the service-role payment RPCs (attempt creation, inbox, observations).
 * Never use it to load panels or read user data; those go through the user JWT and RLS.
 * Each RPC re-checks the service role inside the database.
 */
export function getPaymentsServiceClient() {
  assertAuthorizedPaymentsTarget(); // a different project blocks every privileged RPC
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (isDemoModeEnabled() || !key) throw new Error("Configuración de pagos no disponible.");
  return createClient(getSupabasePublicConfig().url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}
