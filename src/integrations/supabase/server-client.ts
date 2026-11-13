import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabasePublicConfig } from "@/integrations/supabase/config";
import { ConfigurationError } from "@/integrations/supabase/config";
import { isDemoModeEnabled } from "@/config/demo-mode";

export async function getSupabaseServerClient() {
  if (isDemoModeEnabled()) throw new ConfigurationError();
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabasePublicConfig();

  return createServerClient(url, publishableKey, {
    // Account access and review revisions must never reuse Next.js Data Cache entries.
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot always write cookies. Middleware refreshes
          // sessions for navigations where this is necessary.
        }
      },
    },
  });
}
