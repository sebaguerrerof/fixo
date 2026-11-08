import type { ReactNode } from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { adminNavigation } from "@/features/admin/admin-navigation";
import { getServerAuthenticatedUser } from "@/services/auth/server-authentication-service";

interface AdminDashboardShellProps {
  readonly activeHref: string;
  readonly children: ReactNode;
}

export async function AdminDashboardShell({ activeHref, children }: AdminDashboardShellProps) {
  const user = await getServerAuthenticatedUser();
  return <DashboardShell activeHref={activeHref} navigation={adminNavigation} requiredRole="superadmin" roleLabel="Control de plataforma" userName={user?.name ?? "Administración"}>{children}</DashboardShell>;
}
