import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";

const mocks=vi.hoisted(()=>({sdk:vi.fn(),user:vi.fn(),profile:vi.fn()}));
vi.mock("@supabase/ssr",()=>({createServerClient:mocks.sdk}));
beforeEach(()=>{
  vi.stubEnv("NODE_ENV","production");
  vi.stubEnv("NEXT_PUBLIC_DEMO_MODE","false");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY","sb_publishable_test_only");
  const query={select:()=>query,eq:()=>query,maybeSingle:mocks.profile};
  mocks.sdk.mockReturnValue({auth:{getUser:mocks.user},from:()=>query});
});
afterEach(()=>{vi.unstubAllEnvs();vi.resetAllMocks();});
describe("protected route boundary",()=>{
  it.each(["/admin","/admin/tecnicos","/cliente","/tecnico"])("redirects forged demo sessions at %s before rendering",async(path)=>{
    mocks.user.mockResolvedValue({data:{user:null}});
    const response=await middleware(new NextRequest('https://app.example.invalid'+path,{headers:{cookie:'fixo_demo_session=forged'}}));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://app.example.invalid/login');
    expect(mocks.profile).not.toHaveBeenCalled();
  });
  it("does not use an administrative role from user-editable metadata",async()=>{
    mocks.user.mockResolvedValue({data:{user:{id:'customer',user_metadata:{role:'superadmin'}}}});
    mocks.profile.mockResolvedValue({data:{role:'customer'},error:null});
    expect((await middleware(new NextRequest('https://app.example.invalid/admin'))).status).toBe(307);
  });
  it("allows the verified operational administrator role",async()=>{
    mocks.user.mockResolvedValue({data:{user:{id:'moderator'}}});
    mocks.profile.mockResolvedValue({data:{role:'moderator'},error:null});
    expect((await middleware(new NextRequest('https://app.example.invalid/admin'))).headers.get('x-middleware-next')).toBe('1');
  });
  it("keeps the similarly named public technician directory accessible",async()=>{
    mocks.user.mockResolvedValue({data:{user:null}});
    expect((await middleware(new NextRequest('https://app.example.invalid/tecnicos'))).headers.get('x-middleware-next')).toBe('1');
    expect(mocks.profile).not.toHaveBeenCalled();
  });
});
