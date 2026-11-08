import type { AuthenticatedUser } from "@/integrations/auth/auth-provider";

export const DEMO_SESSION_COOKIE = "fixo_demo_session";

export function encodeDemoSession(user: AuthenticatedUser): string {
  return encodeURIComponent(JSON.stringify(user));
}

export function decodeDemoSession(raw: string | undefined): AuthenticatedUser | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw));
    if (!parsed || typeof parsed !== "object") return null;
    const { id, name, email, role } = parsed as Record<string, unknown>;
    if (typeof id !== "string" || typeof name !== "string" || typeof email !== "string") return null;
    if (role !== "customer" && role !== "technician" && role !== "moderator" && role !== "superadmin") return null;
    return { id, name, email, role };
  } catch {
    return null;
  }
}
