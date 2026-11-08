import { isSupabaseConfigured } from "@/integrations/supabase/config";

/**
 * Demo Mode se activa explícitamente con NEXT_PUBLIC_DEMO_MODE=true, o
 * automáticamente cuando Supabase no está configurado (fallback seguro para
 * previews/deploys sin credenciales). NEXT_PUBLIC_DEMO_MODE=false fuerza
 * producción real aunque falten credenciales (falla explícita, no silenciosa).
 */
export function isDemoModeEnabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_DEMO_MODE;
  if (flag === "false") return false;
  if (flag === "true") return true;
  return !isSupabaseConfigured();
}
