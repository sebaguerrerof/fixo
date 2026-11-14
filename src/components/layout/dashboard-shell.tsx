import type { ReactNode } from "react";
import { LayoutDashboard } from "lucide-react";
import Link from "next/link";

import { LogoutButton } from "@/components/auth/logout-button";
import { Logo } from "@/components/shared/logo";
import { Avatar } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { isDemoModeEnabled } from "@/config/demo-mode";
import type { UserRole } from "@/domain/enums/roles";
import { cn } from "@/lib/utils";
import { requireServerRole } from "@/services/auth/server-authentication-service";

interface DashboardNavigationItem {
  readonly href: string;
  readonly label: string;
}

interface DashboardShellProps {
  readonly roleLabel: string;
  readonly requiredRole: UserRole;
  readonly userName: string;
  readonly navigation: readonly DashboardNavigationItem[];
  readonly activeHref: string;
  readonly children: ReactNode;
}

export async function DashboardShell({ roleLabel, requiredRole, userName, navigation, activeHref, children }: DashboardShellProps) {
  // The same verified server session that authorizes the page also authorizes its shell.
  // A second browser Auth request could leave an already-authorized refresh waiting indefinitely.
  await requireServerRole(requiredRole === "superadmin" ? ["moderator", "superadmin"] : [requiredRole]);
  return (
    <div className="min-h-screen bg-muted/40">
      {isDemoModeEnabled() ? <p className="border-b border-warning-border bg-warning-soft px-4 py-2 text-center text-sm font-medium text-warning-soft-foreground">Modo demostración: datos de ejemplo, nada se guarda de verdad.</p> : null}
      <header className="sticky top-0 z-30 border-b border-border bg-background">
        <div className="container flex h-header items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-4"><Logo /><span className="hidden border-l border-border pl-4 text-sm font-medium text-muted-foreground sm:inline">{roleLabel}</span></div>
          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <Link aria-label="Mi perfil" className="press touch-area rounded-full" href="/perfil"><Avatar className="size-9" name={userName} /></Link>
            <LogoutButton />
          </div>
        </div>
      </header>
      <div className="container grid gap-4 py-5 lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-8 lg:py-8">
        <aside className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5 lg:mx-0 lg:overflow-visible lg:px-0">
          <nav aria-label={`Navegación ${roleLabel}`} className="flex min-w-max gap-1 py-1 lg:min-w-0 lg:flex-col">
            <div className="hidden items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:flex"><LayoutDashboard aria-hidden="true" className="size-3.5" />Panel</div>
            {navigation.map((item) => {
              const active = item.href === activeHref;
              return (
                <Link aria-current={active ? "page" : undefined} className={cn("press flex min-h-11 items-center whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors duration-fast", active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-card/70 hover:text-foreground")} href={item.href} key={item.href}>{item.label}</Link>
              );
            })}
          </nav>
        </aside>
        <main className="min-w-0 pb-6">{children}</main>
      </div>
    </div>
  );
}
