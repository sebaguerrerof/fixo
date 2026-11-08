import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabasePublicConfig } from "@/integrations/supabase/config";

export async function getSupabaseServerClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabasePublicConfig();

  return createServerClient(url, publishableKey, {
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
