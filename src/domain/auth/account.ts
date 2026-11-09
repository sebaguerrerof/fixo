import { z } from "zod";

export const accountStatusSchema = z.enum(["active", "suspended", "blocked"]);
export type AccountStatus = z.infer<typeof accountStatusSchema>;
export const roleSchema = z.enum(["customer", "technician", "moderator", "superadmin"]);
export const accountAccessSchema = z.object({
  id: z.string().uuid(), name: z.string(), role: roleSchema,
  account_status: accountStatusSchema, allowed: z.boolean(), invitation_pending: z.boolean(),
});
export type AccountAccess = z.infer<typeof accountAccessSchema>;

export const phoneSchema = z.string().trim().regex(/^\+?[0-9 ()-]{8,24}$/, "Ingresa un teléfono válido.")
  .refine(value => { const digits=value.replace(/\D/g, ""); return digits.length>=8&&digits.length<=15; }, "El teléfono debe incluir entre 8 y 15 dígitos.");
export const nameSchema = z.string().trim().min(1, "Completa este campo.").max(60);
export const newPasswordSchema = z.string().min(12, "Usa al menos 12 caracteres.").max(128)
  .regex(/[a-z]/, "Incluye una minúscula.").regex(/[A-Z]/, "Incluye una mayúscula.").regex(/[0-9]/, "Incluye un número.");
export const profileInputSchema = z.object({ firstName: nameSchema, lastName: nameSchema, phone: phoneSchema })
  .refine(v => v.firstName.length + v.lastName.length + 1 <= 120, { path: ["lastName"], message: "El nombre completo admite hasta 120 caracteres." });
export const professionalInputSchema = z.object({
  city: z.string().trim().min(2).max(80), headline: z.string().trim().max(180), bio: z.string().trim().max(2000),
  coverageAreas: z.string().trim().min(2).max(320), categoryIds: z.array(z.string().regex(/^[a-z0-9-]+$/)).min(1).max(8),
});
export const profileUpdateSchema = profileInputSchema.safeExtend({ professional: professionalInputSchema.nullable().default(null) });
export const invitationInputSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254), fullName: z.string().trim().min(2).max(120), role: roleSchema,
  operationId: z.string().uuid(), resend: z.boolean().default(false),
});
export const accountChangeSchema = z.object({
  targetUser: z.string().uuid(), newStatus: accountStatusSchema.nullable(), newRole: roleSchema.nullable(),
  reason: z.string().trim().min(3, "Explica el motivo (mínimo 3 caracteres).").max(500), operationId: z.string().uuid(),
}).refine(v => v.newStatus !== null || v.newRole !== null, { message: "Selecciona un cambio." });

/** Fixed same-origin destinations. Reject protocol-relative paths and encoded separators. */
export function safeContinuation(value: string | null | undefined, fallback: string): string {
  if (!value || !/^\/(cliente|tecnico|admin|perfil)(\/[^?#\\%]*)?$/.test(value)) return fallback;
  return value;
}
