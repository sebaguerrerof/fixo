"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { checkPasswordFlow } from "@/services/auth/auth-flow-service";
import { getSupabaseServerClient } from "@/integrations/supabase/server-client";
import { newPasswordSchema, profileInputSchema } from "@/domain/auth/account";
const schema = z.object({ password: newPasswordSchema, confirmPassword: z.string() }).refine(v => v.password === v.confirmPassword);
export async function updatePassword(form: FormData): Promise<void> {
  let success = false;
  try {
    const input = schema.parse(Object.fromEntries(form));
    const kind = await checkPasswordFlow(false);
    if (!kind) throw new Error("Invalid flow");
    const profile = kind === "invite" ? profileInputSchema.parse(Object.fromEntries(form)) : null;
    if (kind === "invite" && form.get("acceptTerms") !== "on") throw new Error("Consent required");
    const client = await getSupabaseServerClient();
    const { data: access } = await client.rpc("my_account_access");
    if (access?.account_status !== "active" || (kind === "invite" ? !access?.invitation_pending : !access?.allowed)) throw new Error("Account disabled");
    if (!await checkPasswordFlow(true)) throw new Error("Consumed flow");
    const { error } = await client.auth.updateUser({ password: input.password });
    if (error) throw new Error("Password update failed");
    if (kind === "invite" && profile) {
      const { error: inviteError } = await client.rpc("accept_my_invitation", { first_name: profile.firstName, last_name: profile.lastName, phone_number: profile.phone, terms_accepted: true });
      if (inviteError) throw new Error("Invite completion failed");
    }
    const { error: logoutError } = await client.auth.signOut({ scope: "global" });
    if (logoutError) throw new Error("Session revocation failed");
    success = true;
  } catch { /* No secrets, tokens or internal errors returned. */ }
  redirect(success ? "/login?password=updated" : "/auth/update-password?error=invalid");
}
