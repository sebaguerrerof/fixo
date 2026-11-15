import { afterEach, describe, expect, it, vi } from "vitest";

// The catalog renders forms with sample data, so it must exist only in development with the demo mode on.
vi.mock("server-only", () => ({}));

// The page imports every form in the catalog, so the first import is slow on a busy machine.
const IMPORT_TIMEOUT = 60_000;

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe("/design component catalog", () => {
  it("is a 404 when the demo mode is off (as in every deployed environment)", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false");
    const { default: DesignCatalogPage } = await import("./page");
    expect(() => DesignCatalogPage()).toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
  }, IMPORT_TIMEOUT);

  it("is a 404 on Vercel even if the demo flag is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    vi.stubEnv("VERCEL_ENV", "production");
    const { default: DesignCatalogPage } = await import("./page");
    expect(() => DesignCatalogPage()).toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
  }, IMPORT_TIMEOUT);

  it("renders in development with the demo mode on", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    const { default: DesignCatalogPage } = await import("./page");
    expect(() => DesignCatalogPage()).not.toThrow();
  }, IMPORT_TIMEOUT);
});
