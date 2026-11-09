import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isDemoModeEnabled } from "@/config/demo-mode";
import { assertServerEnvironment } from "@/config/server-environment";
import { getSupabasePublicConfig } from "@/integrations/supabase/config";
import { allowedRouteRoles } from "@/domain/auth/protected-routes";
import type { UserRole } from "@/domain/enums/roles";
import { accountAccessSchema } from "@/domain/auth/account";

export async function middleware(request: NextRequest) {
  try { assertServerEnvironment(); } catch {
    return new NextResponse("Fixo no está disponible temporalmente. Inténtalo más tarde.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "300" },
    });
  }
  if (isDemoModeEnabled()) return NextResponse.next();
  const { url, publishableKey } = getSupabasePublicConfig();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const roles = allowedRouteRoles(request.nextUrl.pathname);
  if (roles) {
    const profile = user ? await supabase.rpc("my_account_access") : null;
    const access = accountAccessSchema.safeParse(profile?.data);
    const role: unknown = profile?.error || !access.success ? null : access.data.role;
    if (user && access.success && !access.data.allowed) {
      const denied = NextResponse.redirect(new URL("/cuenta-no-disponible", request.url));
      denied.headers.set("Cache-Control", "no-store");
      response.cookies.getAll().forEach(cookie => denied.cookies.set(cookie));
      return denied;
    }
    if (!user || typeof role !== "string" || !roles.includes(role as UserRole)) {
      const denied = NextResponse.redirect(new URL("/login", request.url));
      denied.headers.set("Cache-Control", "no-store");
      response.cookies.getAll().forEach(cookie => denied.cookies.set(cookie));
      return denied;
    }
  }
  if (request.nextUrl.pathname.startsWith("/auth")) {
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Robots-Tag", "noindex");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
