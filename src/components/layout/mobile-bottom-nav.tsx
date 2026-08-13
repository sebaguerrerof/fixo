"use client";

import { House, Search, Siren, UserRound, type LucideIcon } from "lucide-react";
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
  readonly emergency?: boolean;
}

const navigation: readonly MobileNavigationItem[] = [
  { href: "/", label: "Inicio", icon: House },
  { href: "/tecnicos", label: "Buscar", icon: Search },
  { href: "/urgencia", label: "Urgencia", icon: Siren, emergency: true },
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => setSession(new AuthenticationService().getCurrentSession()), []);
  const accountHref = session ? dashboardForRole(session.user.role) : "/login";
  const accountActive = pathname === accountHref;

  return <nav aria-label="Navegación móvil" className="fixed inset-x-3 bottom-3 z-50 flex h-16 items-center justify-around rounded-2xl border border-white/30 bg-slate-950/90 px-2 text-white shadow-lift backdrop-blur md:hidden">{navigation.map((item) => { const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href); const Icon = item.icon; return <Link key={item.href} className={cn("flex min-w-14 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-semibold transition", active ? "bg-white/15 text-white" : "text-slate-300", item.emergency && "text-rose-200")} href={item.href}><Icon className={cn("size-4", item.emergency && "fill-current")} /><span>{item.label}</span></Link>; })}<Link className={cn("flex min-w-14 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-semibold transition", accountActive ? "bg-white/15 text-white" : "text-slate-300")} href={accountHref}><UserRound className="size-4" /><span>Cuenta</span></Link></nav>;
}
