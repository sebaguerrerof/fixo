import { afterEach, describe, expect, it } from "vitest";

import { isDemoModeEnabled } from "@/config/demo-mode";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env.NEXT_PUBLIC_DEMO_MODE = ORIGINAL_ENV.NEXT_PUBLIC_DEMO_MODE;
  process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL_ENV.NEXT_PUBLIC_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = ORIGINAL_ENV.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
});

describe("isDemoModeEnabled", () => {
  it("is enabled when the flag is explicitly true", () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "true";
    expect(isDemoModeEnabled()).toBe(true);
  });

  it("does not fall back to demo when Supabase is not configured", () => {
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    expect(isDemoModeEnabled()).toBe(false);
  });

  it("is disabled when explicitly set to false, even without Supabase", () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(isDemoModeEnabled()).toBe(false);
  });

  it("is disabled when Supabase is configured and the flag is unset", () => {
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "public-key";
    expect(isDemoModeEnabled()).toBe(false);
  });
});
