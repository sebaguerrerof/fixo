import { isDemoModeEnabled } from "./demo-mode";
import { ConfigurationError, getSupabasePublicConfig } from "../integrations/supabase/config";

/** Validate at build and server entry points; never log environment values. */
export function assertServerEnvironment(): void {
  if ((process.env.NODE_ENV === "production" || process.env.VERCEL_ENV)
    && process.env.NEXT_PUBLIC_DEMO_MODE === "true") throw new ConfigurationError();
  if (!isDemoModeEnabled()) getSupabasePublicConfig();
}
