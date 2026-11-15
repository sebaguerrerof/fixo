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
  mocks.sdk.mockReturnValue({auth:{getUser:mocks.user},from:()=>query,rpc:mocks.profile});
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
    mocks.profile.mockResolvedValue({data:{id:'10000000-0000-4000-8000-000000000001',name:'Customer',role:'customer',account_status:'active',allowed:true,invitation_pending:false},error:null});
    expect((await middleware(new NextRequest('https://app.example.invalid/admin'))).status).toBe(307);
  });
  it("allows the verified operational administrator role",async()=>{
    mocks.user.mockResolvedValue({data:{user:{id:'moderator'}}});
    mocks.profile.mockResolvedValue({data:{id:'10000000-0000-4000-8000-000000000001',name:'Moderator',role:'moderator',account_status:'active',allowed:true,invitation_pending:false},error:null});
    expect((await middleware(new NextRequest('https://app.example.invalid/admin'))).headers.get('x-middleware-next')).toBe('1');
  });
  it("keeps the similarly named public technician directory accessible",async()=>{
    mocks.user.mockResolvedValue({data:{user:null}});
    expect((await middleware(new NextRequest('https://app.example.invalid/tecnicos'))).headers.get('x-middleware-next')).toBe('1');
    expect(mocks.profile).not.toHaveBeenCalled();
  });
  it.each(['suspended','blocked'])("rejects %s with an existing Auth session",async(status)=>{
    mocks.user.mockResolvedValue({data:{user:{id:'10000000-0000-4000-8000-000000000001'}}});
    mocks.profile.mockResolvedValue({data:{id:'10000000-0000-4000-8000-000000000001',name:'Account',role:'customer',account_status:status,allowed:false,invitation_pending:false},error:null});
    const response=await middleware(new NextRequest('https://app.example.invalid/cliente'));
    expect(response.headers.get('location')).toBe('https://app.example.invalid/cuenta-no-disponible');
  });
  it("fails closed when the account state cannot be read",async()=>{
    mocks.user.mockResolvedValue({data:{user:{id:'account'}}});
    mocks.profile.mockResolvedValue({data:null,error:{code:'schema-missing'}});
    expect((await middleware(new NextRequest('https://app.example.invalid/admin'))).headers.get('location')).toBe('https://app.example.invalid/login');
  });
  it("does not accept unknown roles from an inconsistent profile",async()=>{
    mocks.user.mockResolvedValue({data:{user:{id:'account'}}});
    mocks.profile.mockResolvedValue({data:{id:'10000000-0000-4000-8000-000000000001',name:'Account',role:'owner',account_status:'active',allowed:true,invitation_pending:false},error:null});
    expect((await middleware(new NextRequest('https://app.example.invalid/admin'))).headers.get('location')).toBe('https://app.example.invalid/login');
  });
});

describe("component catalog route (/design)",()=>{
  it.each(["/design","/design/","/design/anything"])("answers a real 404 before rendering outside development with demo mode, without touching Auth: %s",async(path)=>{
    const response=await middleware(new NextRequest('https://app.example.invalid'+path));
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.sdk).not.toHaveBeenCalled();
  });
  it("is never served on Vercel even if the demo flag is set (the environment guard answers 503 for the whole site before the route is considered)",async()=>{
    vi.stubEnv("NODE_ENV","development");vi.stubEnv("NEXT_PUBLIC_DEMO_MODE","true");vi.stubEnv("VERCEL_ENV","production");
    const response=await middleware(new NextRequest('https://app.example.invalid/design'));
    expect(response.status).toBe(503);
    expect(response.headers.get('x-middleware-next')).toBeNull();
  });
  it("is reachable in development with the demo mode on",async()=>{
    vi.stubEnv("NODE_ENV","development");vi.stubEnv("NEXT_PUBLIC_DEMO_MODE","true");
    const response=await middleware(new NextRequest('https://app.example.invalid/design'));
    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });
  it("does not capture similarly named routes",async()=>{
    mocks.user.mockResolvedValue({data:{user:null}});
    for(const path of ["/designers","/tecnicos/design"]) expect((await middleware(new NextRequest('https://app.example.invalid'+path))).status,path).not.toBe(404);
  });
});
