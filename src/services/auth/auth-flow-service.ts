import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/integrations/supabase/admin-client";
import { getSupabaseServerClient } from "@/integrations/supabase/server-client";

const FLOW_COOKIE = "fixo_auth_flow";
export function flowHash(token: string): string { return createHash("sha256").update(token).digest("hex"); }

/** Called only after Auth verifies a recovery/invite OTP; pending invitation state chooses the completion path. */
export async function issuePasswordFlow(session: Session, kind: "recovery" | "invite"): Promise<void> {
  const claims = JSON.parse(Buffer.from(session.access_token.split(".")[1], "base64url").toString()) as { session_id?: string };
  if (!claims.session_id) throw new Error("Sesión no disponible.");
  const token = randomBytes(32).toString("base64url");
  const { error } = await getSupabaseAdminClient().rpc("issue_auth_flow", {
    flow_hash: flowHash(token), target_user: session.user.id, target_session: claims.session_id, flow_kind: kind,
  });
  if (error) throw new Error("No pudimos validar el enlace.");
  (await cookies()).set(FLOW_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/auth", maxAge: 900 });
}
export async function checkPasswordFlow(consume = false): Promise<"recovery" | "invite" | null> {
  const token = (await cookies()).get(FLOW_COOKIE)?.value;
  if (!token || token.length !== 43) return null;
  const client = await getSupabaseServerClient();
  const { data: identity } = await client.auth.getUser();
  if (!identity.user) return null;
  const { data, error } = await client.rpc("check_auth_flow", { flow_hash: flowHash(token), consume });
  if (error || (data !== "recovery" && data !== "invite")) return null;
  if (consume) (await cookies()).delete(FLOW_COOKIE);
  return data;
}
export async function allowAuthAttempt(action: string, email: string, limit = 5): Promise<boolean> {
  const { data, error } = await getSupabaseAdminClient().rpc("consume_auth_rate_limit", {
    rate_key: `${action}:${flowHash(email.trim().toLowerCase())}`, max_attempts: limit,
  });
  return !error && data === true;
}
