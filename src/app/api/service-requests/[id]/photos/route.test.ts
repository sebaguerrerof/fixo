import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ user: vi.fn(), client: vi.fn() }));
vi.mock("@/services/auth/server-authentication-service", () => ({ getServerAuthenticatedUser: mocks.user }));
vi.mock("@/integrations/supabase/server-client", () => ({ getSupabaseServerClient: mocks.client }));
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });
describe("photo upload origin boundary", () => {
  it.each([undefined, "https://evil.invalid"])("rejects foreign/missing origin %s before authentication or Storage", async origin => {
    vi.stubEnv("FIXO_APP_URL", "https://soyfixo.cl");
    const response = await POST(new Request("https://soyfixo.cl/api/service-requests/id/photos", { method: "POST", headers: origin ? { origin } : {} }), { params: Promise.resolve({ id: "invalid" }) });
    expect(response.status).toBe(403); expect(mocks.user).not.toHaveBeenCalled(); expect(mocks.client).not.toHaveBeenCalled();
  });
});
