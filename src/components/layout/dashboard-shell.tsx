import type { ReactNode } from "react";
import { Bell, ChevronRight, LayoutDashboard } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/shared/logo";
import { Avatar } from "@/components/ui/avatar";
import { ProtectedDashboard } from "@/components/auth/protected-dashboard";
import type { UserRole } from "@/domain/enums/roles";
import { cn } from "@/lib/utils";
import { isDemoModeEnabled } from "@/config/demo-mode";

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

export function DashboardShell({ roleLabel, requiredRole, userName, navigation, activeHref, children }: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-muted/40">
      {isDemoModeEnabled() ? <p className="bg-amber-100 px-4 py-2 text-center text-sm font-semibold text-amber-950">Demostración local: identidades y operaciones de ejemplo, sin persistencia real.</p> : null}
      <header className="border-b bg-background">
        <div className="container flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-4"><Logo /><span className="hidden border-l pl-4 text-sm font-medium text-muted-foreground sm:inline">{roleLabel}</span></div>
          <div className="flex items-center gap-3"><Bell className="size-5 text-muted-foreground" /><Avatar name={userName} className="size-9" /></div>
        </div>
      </header>
      <div className="container grid gap-6 py-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="overflow-x-auto lg:overflow-visible">
          <nav aria-label={`Navegación ${roleLabel}`} className="flex min-w-max gap-1 lg:flex-col">
            <div className="hidden items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:flex"><LayoutDashboard className="size-3.5" />Panel</div>
            {navigation.map((item) => <Link key={item.href} href={item.href} className={cn("inline-flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-background hover:text-foreground", item.href === activeHref && "bg-background text-foreground shadow-sm")}><span>{item.label}</span><ChevronRight className="hidden size-4 lg:block" /></Link>)}
          </nav>
        </aside>
        <main className="min-w-0"><ProtectedDashboard allowedRoles={requiredRole === "superadmin" ? ["moderator", "superadmin"] : [requiredRole]}>{children}</ProtectedDashboard></main>
      </div>
    </div>
  );
}
