import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTechnicianDocumentUrl } from "./technician-document-service";

const mocks = vi.hoisted(() => ({ user:vi.fn(), client:vi.fn(), single:vi.fn(), sign:vi.fn() }));
vi.mock("@/services/auth/server-authentication-service", () => ({ getServerAuthenticatedUser:mocks.user }));
vi.mock("@/integrations/supabase/server-client", () => ({ getSupabaseServerClient:mocks.client }));
const id = "00000000-0000-4000-8000-000000000001";
function prepare(role = "technician", owner = "owner", path = "owner/certificate.pdf") {
  mocks.user.mockResolvedValue({id:"owner",role});
  mocks.single.mockResolvedValue({data:{technician_id:owner,storage_path:path,inspection_status:"clean",current_document:true},error:null});
  const query = {select:()=>query,eq:()=>query,maybeSingle:mocks.single};
  mocks.client.mockResolvedValue({from:()=>query,storage:{from:()=>({createSignedUrl:mocks.sign})}});
  mocks.sign.mockResolvedValue({data:{signedUrl:"https://example.invalid/signed"},error:null});
}
beforeEach(() => vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false"));
afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); });
describe("private verification document URLs", () => {
  it("never uses a demo identity to sign real Storage documents", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    prepare("moderator");
    await expect(getTechnicianDocumentUrl(id)).rejects.toThrow("Documento no disponible");
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("returns a route that reauthorizes each download instead of exposing a cached bearer URL", async () => {
    prepare();
    expect(await getTechnicianDocumentUrl(id)).toBe(`/api/technician-documents/${id}`);
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("allows an operational administrator to inspect another technician's document", async () => {
    prepare("moderator","other","other/certificate.pdf");
    await getTechnicianDocumentUrl(id);
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it.each(["quarantined","unsafe","error"])("blocks %s content before issuing a download route", async inspection_status=>{
    prepare();mocks.single.mockResolvedValue({data:{technician_id:"owner",storage_path:"owner/certificate.pdf",inspection_status,current_document:true},error:null});
    await expect(getTechnicianDocumentUrl(id)).rejects.toThrow("Documento no disponible");
  });
  it.each(["customer", "unowned", "traversal", "missing"])("refuses %s without signing a URL", async (scenario) => {
    prepare(scenario === "customer" ? "customer" : "technician",scenario === "unowned" ? "other" : "owner",scenario === "traversal" ? "owner/../secret.pdf" : "owner/certificate.pdf");
    if (scenario === "missing") mocks.single.mockResolvedValue({data:null,error:null});
    await expect(getTechnicianDocumentUrl(id)).rejects.toThrow("Documento no disponible");
    expect(mocks.sign).not.toHaveBeenCalled();
  });
});
