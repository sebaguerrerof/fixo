import { afterEach, describe, expect, it, vi } from "vitest";
import { submitServiceRequest } from "./actions";

const mocks = vi.hoisted(() => ({user:vi.fn(),create:vi.fn(),updateStatus:vi.fn()}));
vi.mock("@/services/auth/server-authentication-service",()=>({getServerAuthenticatedUser:mocks.user}));
vi.mock("@/repositories/repository-factory",()=>({getServiceRequestRepository:()=>({create:mocks.create,updateStatus:mocks.updateStatus})}));
const input = {title:"Revisión de instalación",categoryId:"electricidad",description:"Necesito una revisión de la instalación de mi cocina.",locationLabel:"Ñuñoa",priority:"standard" as const,scheduledFor:""};
afterEach(()=>{vi.resetAllMocks();vi.unstubAllEnvs();});
describe("service request submission",()=>{
  it("persists a real request without attempting forbidden commercial updates",async()=>{
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE","false");
    mocks.user.mockResolvedValue({id:"customer",role:"customer"});
    mocks.create.mockResolvedValue({id:"request"});
    expect(await submitServiceRequest(input)).toEqual({ok:true});
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({customerId:"customer"}));
    expect(mocks.updateStatus).not.toHaveBeenCalled();
  });
  it.each([null,{id:"admin",role:"superadmin"},{id:"tech",role:"technician"}])("rejects a non-customer actor",async(user)=>{
    mocks.user.mockResolvedValue(user);
    expect((await submitServiceRequest(input)).ok).toBe(false);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("does not expose infrastructure errors",async()=>{
    mocks.user.mockResolvedValue({id:"customer",role:"customer"});
    mocks.create.mockRejectedValue(new Error("internal SQL connection details"));
    const result=await submitServiceRequest(input);
    expect(result.ok).toBe(false);
    expect(result.message).not.toContain("SQL");
  });
});
