import type { ReactNode } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { TechnicianDashboardShell } from "@/components/technicians/technician-dashboard-shell";
import { AdminDashboardShell } from "@/components/admin/admin-dashboard-shell";
import { requireServerRole } from "@/services/auth/server-authentication-service";
export type JobArea = "cliente" | "tecnico" | "admin";
export const customerNavigation = [{ href: "/cliente", label: "Mis solicitudes" }, { href: "/cliente/trabajos", label: "Mis trabajos" }, { href: "/perfil", label: "Mi perfil" }];
export async function JobShell({ area, children }: { readonly area: JobArea; readonly children: ReactNode }) {
  const user = await requireServerRole(area === "admin" ? ["moderator", "superadmin"] : [area === "cliente" ? "customer" : "technician"]);
  if (area === "admin") return <AdminDashboardShell activeHref="/admin/trabajos">{children}</AdminDashboardShell>;
  if (area === "tecnico") return <TechnicianDashboardShell activeHref="/tecnico/trabajos">{children}</TechnicianDashboardShell>;
  return <DashboardShell activeHref="/cliente/trabajos" requiredRole="customer" roleLabel="Espacio cliente" userName={user.name} navigation={customerNavigation}>{children}</DashboardShell>;
}
