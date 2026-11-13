import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabaseServerClient } from "./server-client";
import { getSupabaseBrowserClient } from "./browser-client";

const mocks=vi.hoisted(()=>({server:vi.fn(),browser:vi.fn(),cookies:vi.fn()}));
vi.mock("@supabase/ssr",()=>({createServerClient:mocks.server,createBrowserClient:mocks.browser}));
vi.mock("next/headers",()=>({cookies:mocks.cookies}));
afterEach(()=>{vi.unstubAllEnvs();vi.resetAllMocks();});
describe("demo isolation from real infrastructure",()=>{
  it("never opens a real browser or server client with a demo identity",async()=>{
    vi.stubEnv("NODE_ENV","development");
    vi.stubEnv("VERCEL_ENV",undefined);
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE","true");
    expect(()=>getSupabaseBrowserClient()).toThrow("Fixo no está disponible");
    await expect(getSupabaseServerClient()).rejects.toThrow("Fixo no está disponible");
    expect(mocks.server).not.toHaveBeenCalled();
    expect(mocks.browser).not.toHaveBeenCalled();
    expect(mocks.cookies).not.toHaveBeenCalled();
  });
});
