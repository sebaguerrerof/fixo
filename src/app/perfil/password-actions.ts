"use server";
import { z } from "zod";

import { isDemoModeEnabled } from "@/config/demo-mode";
import { newPasswordSchema } from "@/domain/auth/account";
import { getSupabaseServerClient } from "@/integrations/supabase/server-client";
import { requireServerRole } from "@/services/auth/server-authentication-service";

const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(128), password: newPasswordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"] })
  .refine((v) => v.password !== v.currentPassword, { path: ["password"] });

export interface ChangePasswordResult { readonly ok: boolean; readonly message: string }

/**
 * Change the password of the signed-in account. The current password is verified first (so an open session alone cannot take over
 * the account), then the new one is set and every OTHER session is revoked. No secret is ever returned or logged.
 */
export async function changePasswordAction(raw: unknown): Promise<ChangePasswordResult> {
  if (isDemoModeEnabled()) return { ok: false, message: "El cambio de contraseña no está disponible en el modo demostración." };
  const parsed = changePasswordSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Revisa los datos: la nueva contraseña debe cumplir los requisitos, ser distinta de la actual y coincidir en ambos campos." };
  try {
    const user = await requireServerRole(["customer", "technician", "moderator", "superadmin"]);
    const client = await getSupabaseServerClient();
    const proof = await client.auth.signInWithPassword({ email: user.email, password: parsed.data.currentPassword });
    if (proof.error) return { ok: false, message: "La contraseña actual no es correcta." };
    const { error } = await client.auth.updateUser({ password: parsed.data.password });
    if (error) return { ok: false, message: "No pudimos cambiar la contraseña. Inténtalo nuevamente." };
    const { error: revokeError } = await client.auth.signOut({ scope: "others" });
    if (revokeError) return { ok: true, message: "Contraseña actualizada, pero no pudimos cerrar tus otras sesiones. Ciérralas desde cada dispositivo." };
    return { ok: true, message: "Contraseña actualizada. Cerramos tus otras sesiones." };
  } catch {
    return { ok: false, message: "No pudimos cambiar la contraseña. Inténtalo nuevamente." };
  }
}
