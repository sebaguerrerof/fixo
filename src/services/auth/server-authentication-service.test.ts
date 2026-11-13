import { afterEach, describe, expect, it, vi } from "vitest";
import { getServerAuthenticatedUser, requireServerRole } from "./server-authentication-service";
import { encodeDemoSession } from "@/integrations/auth/demo-session-cookie";

const spies = vi.hoisted(() => ({ cookies: vi.fn(), getUser: vi.fn(), client: vi.fn(), redirect: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: spies.cookies }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { spies.redirect(path); throw new Error("redirect"); } }));
vi.mock("@/integrations/supabase/server-client", () => ({ getSupabaseServerClient: spies.client }));
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });

describe("productive authorization", () => {
  it("ignores a forged demo superadmin cookie in a configured production environment", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test_only");
    const cookie = encodeDemoSession({ id: "forged", name: "Forged", email: "forged@example.invalid", role: "superadmin" });
    spies.cookies.mockResolvedValue({ get: () => ({ value: cookie }) });
    spies.getUser.mockResolvedValue({ data: { user: null } });
    spies.client.mockResolvedValue({ auth: { getUser: spies.getUser } });
    expect(await getServerAuthenticatedUser()).toBeNull();
    await expect(requireServerRole(["superadmin"])).rejects.toThrow("redirect");
    expect(spies.redirect).toHaveBeenCalledWith("/login");
    expect(spies.cookies).not.toHaveBeenCalled();
  });
  it("fails closed before reading cookies when production has demo explicitly requested", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    await expect(getServerAuthenticatedUser()).rejects.toThrow("Fixo no está disponible");
    expect(spies.cookies).not.toHaveBeenCalled();
    expect(spies.client).not.toHaveBeenCalled();
  });
});
