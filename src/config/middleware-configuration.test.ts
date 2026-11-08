import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";

const mocks=vi.hoisted(()=>({client:vi.fn()}));
vi.mock("@supabase/ssr",()=>({createServerClient:mocks.client}));
afterEach(()=>{vi.unstubAllEnvs();vi.resetAllMocks();});
describe("unconfigured production requests",()=>{
  it.each(["true","false"])("returns a controlled no-store 503 for invalid config (demo=%s)",async(flag)=>{
    vi.stubEnv("NODE_ENV","production");
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE",flag);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL",undefined);
    const response=await middleware(new NextRequest("https://app.example.invalid/admin",{headers:{cookie:'fixo_demo_session=forged'}}));
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).not.toContain("SUPABASE");
    expect(mocks.client).not.toHaveBeenCalled();
  });
});
