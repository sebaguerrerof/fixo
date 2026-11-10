import { describe, it, expect, vi, afterEach } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ user: vi.fn(), client: vi.fn() }));
vi.mock("@/services/auth/server-authentication-service", () => ({ getServerAuthenticatedUser: mocks.user }));
vi.mock("@/integrations/supabase/server-client", () => ({ getSupabaseServerClient: mocks.client }));
import { POST } from "./route";
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });
describe("incident upload origin", () => {
  it.each([undefined, "https://evil.invalid"])("rejects %s before Auth or privileged Storage", async origin => {
    vi.stubEnv("FIXO_APP_URL", "https://soyfixo.cl");
    const response = await POST(new Request("https://soyfixo.cl/api/job-incidents/id/evidence", { method: "POST", headers: origin ? { origin } : {} }), { params: Promise.resolve({ id: "invalid" }) });
    expect(response.status).toBe(403); expect(mocks.user).not.toHaveBeenCalled(); expect(mocks.client).not.toHaveBeenCalled();
  });
});
