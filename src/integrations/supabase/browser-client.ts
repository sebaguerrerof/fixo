"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabasePublicConfig } from "@/integrations/supabase/config";
import { ConfigurationError } from "@/integrations/supabase/config";
import { isDemoModeEnabled } from "@/config/demo-mode";

let browserClient: SupabaseClient | undefined;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (isDemoModeEnabled()) throw new ConfigurationError();
  if (!browserClient) {
    const { url, publishableKey } = getSupabasePublicConfig();
    browserClient = createBrowserClient(url, publishableKey);
  }

  return browserClient;
}
