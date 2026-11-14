"use client";

import { House, Search, UserRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { dashboardForRole, type AuthSession } from "@/integrations/auth/auth-provider";
import { AuthenticationService } from "@/services/auth/authentication-service";
import { cn } from "@/lib/utils";

interface MobileNavigationItem {
  readonly href: string;
  readonly label: string;
  readonly icon: LucideIcon;
}

const navigation: readonly MobileNavigationItem[] = [
  { href: "/", label: "Inicio", icon: House },
  { href: "/tecnicos", label: "Buscar", icon: Search },
] as const;

function NavLink({ href, label, icon: Icon, active }: MobileNavigationItem & { readonly active: boolean }) {
  return (
    <Link aria-current={active ? "page" : undefined} className={cn("press flex min-h-12 min-w-16 flex-col items-center justify-center gap-0.5 rounded-xl px-3 text-[11px] font-semibold transition-colors duration-fast", active ? "bg-inverse-foreground/15 text-inverse-foreground" : "text-inverse-muted")} href={href}>
      <Icon aria-hidden="true" className="size-5" />
      <span>{label}</span>
    </Link>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    let isMounted = true;
    void new AuthenticationService().getCurrentSession().then((nextSession) => { if (isMounted) setSession(nextSession); }).catch(() => { if (isMounted) setSession(null); });
    return () => { isMounted = false; };
  }, []);

  const accountHref = session ? dashboardForRole(session.user.role) : "/login";

  return (
    <nav aria-label="Navegación móvil" className="safe-bottom fixed inset-x-3 bottom-3 z-50 flex items-center justify-around rounded-2xl border border-inverse-border bg-inverse p-1.5 md:hidden">
      {navigation.map((item) => <NavLink key={item.href} {...item} active={item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)} />)}
      <NavLink href={accountHref} icon={UserRound} label="Cuenta" active={pathname === accountHref} />
    </nav>
  );
}
