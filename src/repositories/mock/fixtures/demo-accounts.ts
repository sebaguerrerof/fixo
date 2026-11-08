import type { AuthenticatedUser } from "@/integrations/auth/auth-provider";

/**
 * Cuentas fijas de Demo Mode. El id del técnico coincide con `tech-01`
 * (Camila Rojas) para que el panel técnico muestre un perfil real y coherente.
 */
export const DEMO_ACCOUNTS: readonly AuthenticatedUser[] = [
  { id: "demo-customer-1", name: "Javiera Contreras", email: "cliente@fixo.cl", role: "customer" },
  { id: "tech-01", name: "Camila Rojas", email: "tecnico@fixo.cl", role: "technician" },
  { id: "demo-admin-1", name: "Equipo Fixo", email: "admin@fixo.cl", role: "superadmin" },
];

export const DEMO_CUSTOMER_ID = "demo-customer-1";
