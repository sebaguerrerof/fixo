import { afterEach, describe, expect, it, vi } from "vitest";
import { isDemoModeEnabled } from "@/config/demo-mode";
import { assertServerEnvironment } from "@/config/server-environment";
import { ConfigurationError, getSupabasePublicConfig } from "@/integrations/supabase/config";

afterEach(() => vi.unstubAllEnvs());

describe("demo environment boundary", () => {
  it.each(["true", "false", undefined])("never enables demo in production (%s)", (flag) => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", flag);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    expect(isDemoModeEnabled()).toBe(false);
    expect(assertServerEnvironment).toThrow(ConfigurationError);
  });
  it("requires explicit opt-in even in unconfigured development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", undefined);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    expect(isDemoModeEnabled()).toBe(false);
    expect(assertServerEnvironment).toThrow(ConfigurationError);
  });
  it("allows explicit demo only in isolated development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", undefined);
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    expect(isDemoModeEnabled()).toBe(true);
    expect(assertServerEnvironment).not.toThrow();
  });
  it.each(["preview", "production", "development"])("forbids demo on Vercel %s", (target) => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", target);
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    expect(isDemoModeEnabled()).toBe(false);
    expect(assertServerEnvironment).toThrow(ConfigurationError);
  });
  it.each(["sb_secret_private", `x.${btoa(JSON.stringify({role:"service_role"}))}.x`, "not-a-key"])("rejects invalid/private public keys without echoing them", (key) => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", key);
    expect(getSupabasePublicConfig).toThrow(ConfigurationError);
    try { getSupabasePublicConfig(); } catch (error) { expect(String(error)).not.toContain(key); }
  });
});
