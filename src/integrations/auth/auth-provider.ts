import { z } from "zod";

import type { UserRole } from "@/domain/enums/roles";

export const signInInputSchema = z.object({
  email: z.string().trim().email("Ingresa un correo válido."),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
});

export type SignInInput = z.infer<typeof signInInputSchema>;

export const authenticatedUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(["customer", "technician", "moderator", "superadmin"]),
});

export type AuthenticatedUser = z.infer<typeof authenticatedUserSchema>;

export const authSessionSchema = z.object({
  user: authenticatedUserSchema,
  createdAt: z.string(),
});

export type AuthSession = z.infer<typeof authSessionSchema>;

export interface AuthProvider {
  signIn(input: SignInInput): Promise<AuthSession>;
}

const dashboardByRole: Record<UserRole, string> = {
  customer: "/cliente",
  technician: "/tecnico",
  moderator: "/admin",
  superadmin: "/admin",
};

export function dashboardForRole(role: UserRole): string {
  return dashboardByRole[role];
}
