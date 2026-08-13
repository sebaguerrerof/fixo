import type { ReactNode } from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { adminNavigation } from "@/features/admin/admin-navigation";

interface AdminDashboardShellProps {
  readonly activeHref: string;
  readonly children: ReactNode;
}

export function AdminDashboardShell({ activeHref, children }: AdminDashboardShellProps) {
  return <DashboardShell activeHref={activeHref} navigation={adminNavigation} requiredRole="superadmin" roleLabel="Control de plataforma" userName="María Admin">{children}</DashboardShell>;
}
