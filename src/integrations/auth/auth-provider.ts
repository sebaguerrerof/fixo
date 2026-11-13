import { z } from "zod";

import type { UserRole } from "@/domain/enums/roles";
import { nameSchema, phoneSchema, newPasswordSchema } from "@/domain/auth/account";

export const signInInputSchema = z.object({
  email: z.string().trim().email("Ingresa un correo válido."),
  password: z.string().min(1, "Ingresa tu contraseña.").max(128),
});

export type SignInInput = z.infer<typeof signInInputSchema>;

export const customerRegistrationInputSchema = z.object({
  firstName: nameSchema, lastName: nameSchema, phone: phoneSchema,
  email: z.string().trim().toLowerCase().email("Ingresa un correo válido.").max(254),
  password: newPasswordSchema, confirmPassword: z.string(),
  acceptTerms: z.boolean().refine(value => value, "Debes aceptar los términos y la privacidad."),
}).refine(value => value.password === value.confirmPassword, { path: ["confirmPassword"], message: "Las contraseñas no coinciden." })
  .refine(value => value.firstName.length + value.lastName.length + 1 <= 120, { path: ["lastName"], message: "El nombre completo admite hasta 120 caracteres." });

export const technicianRegistrationInputSchema = customerRegistrationInputSchema.safeExtend({
  city: z.string().trim().min(2, "Indica tu comuna o ciudad.").max(80),
  coverageAreas: z.string().trim().min(2, "Indica al menos una zona de cobertura.").max(320),
  headline: z.string().trim().max(180).default(""),
  bio: z.string().trim().max(2000).default(""),
  categoryIds: z.array(z.string().regex(/^[a-z0-9-]+$/)).min(1, "Selecciona al menos un rubro.").max(8),
  specialties: z.string().trim().max(320).default(""),
  yearsOfExperience: z.coerce.number().int().min(0).max(80).default(0),
  emergencyEnabled: z.boolean().default(false),
  startingPriceClp: z.coerce.number().int().min(0).max(10000000).default(0),
});

export type CustomerRegistrationInput = z.infer<typeof customerRegistrationInputSchema>;
export type TechnicianRegistrationInput = z.infer<typeof technicianRegistrationInputSchema>;
export type TechnicianRegistrationFormInput = z.input<typeof technicianRegistrationInputSchema>;

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
