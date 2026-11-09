"use server";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/integrations/supabase/server-client";
import { issuePasswordFlow } from "@/services/auth/auth-flow-service";
import { accountAccessSchema } from "@/domain/auth/account";
import { dashboardForRole } from "@/integrations/auth/auth-provider";

export async function confirmAuthLink(form: FormData): Promise<void> {
  let destination = "/auth/callback?error=invalid";
  try {
    const token = String(form.get("token_hash") ?? "");
    const code = String(form.get("code") ?? "");
    const type = String(form.get("type") ?? "email");
    const client = await getSupabaseServerClient();
    if (!["email", "signup", "recovery", "invite"].includes(type)) throw new Error("Invalid link");
    // Password flows require a verified OTP type. A query parameter on a PKCE code cannot grant recovery.
    const result = /^[A-Za-z0-9_-]{32,256}$/.test(token)
      ? await client.auth.verifyOtp({ token_hash: token, type: type as "email" | "signup" | "recovery" | "invite" })
      : /^[A-Za-z0-9_-]{10,256}$/.test(code) && (type === "email" || type === "signup")
        ? await client.auth.exchangeCodeForSession(code) : null;
    if (!result || result.error || !result.data.user || !result.data.session) throw new Error("Invalid link");
    const { data: identity, error: identityError } = await client.auth.getUser();
    if (identityError || identity.user?.id !== result.data.user.id) throw new Error("Invalid session");
    const { data } = await client.rpc("my_account_access");
    const access = accountAccessSchema.parse(data);
    if (access.account_status !== "active") destination = "/cuenta-no-disponible";
    else if (type === "invite" && access.invitation_pending || type === "recovery" && (access.allowed || access.invitation_pending)) {
      await issuePasswordFlow(result.data.session, access.invitation_pending ? "invite" : "recovery");
      destination = "/auth/update-password";
    } else if (access.allowed && type !== "invite" && type !== "recovery") destination = dashboardForRole(access.role);
    else { await client.auth.signOut({ scope: "local" }); }
  } catch { /* Controlled invalid/expired/reused link. Never log token/code. */ }
  redirect(destination);
}
