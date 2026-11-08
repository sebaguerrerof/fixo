import { z } from "zod";

import type { UserRole } from "@/domain/enums/roles";

export const signInInputSchema = z.object({
  email: z.string().trim().email("Ingresa un correo válido."),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
});

export type SignInInput = z.infer<typeof signInInputSchema>;

const fullNameSchema = z.string().trim().min(2, "Ingresa tu nombre completo.").max(120, "El nombre es demasiado largo.");
const passwordSchema = z.string().min(8, "La contraseña debe tener al menos 8 caracteres.");

export const customerRegistrationInputSchema = z.object({
  fullName: fullNameSchema,
  email: z.string().trim().email("Ingresa un correo válido."),
  password: passwordSchema,
});

export const technicianRegistrationInputSchema = customerRegistrationInputSchema.extend({
  city: z.string().trim().min(2, "Indica tu comuna o ciudad.").max(80),
  coverageAreas: z.string().trim().min(2, "Indica al menos una zona de cobertura.").max(320),
  headline: z.string().trim().min(12, "Describe brevemente tu servicio.").max(180),
  bio: z.string().trim().min(30, "Cuéntanos un poco más sobre tu experiencia.").max(2000),
  categoryIds: z.array(z.string()).min(1, "Selecciona al menos un rubro."),
  specialties: z.string().trim().min(2, "Indica al menos una especialidad.").max(320),
  yearsOfExperience: z.coerce.number().int().min(0).max(80),
  emergencyEnabled: z.boolean(),
  startingPriceClp: z.coerce.number().int().min(0).max(10000000),
});

export type CustomerRegistrationInput = z.infer<typeof customerRegistrationInputSchema>;
export type TechnicianRegistrationInput = z.infer<typeof technicianRegistrationInputSchema>;

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

export interface RegistrationResult {
  readonly session: AuthSession | null;
  readonly requiresEmailConfirmation: boolean;
}

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
