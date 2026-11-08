import type { ReactNode } from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { technicianNavigation } from "@/features/technicians/technician-navigation";
import { getServerAuthenticatedUser } from "@/services/auth/server-authentication-service";

interface TechnicianDashboardShellProps {
  readonly activeHref: string;
  readonly children: ReactNode;
}

export async function TechnicianDashboardShell({ activeHref, children }: TechnicianDashboardShellProps) {
  const user = await getServerAuthenticatedUser();
  if (!user) return null;
  return <DashboardShell activeHref={activeHref} navigation={technicianNavigation} requiredRole="technician" roleLabel="Panel técnico" userName={user.name}>{children}</DashboardShell>;
}
