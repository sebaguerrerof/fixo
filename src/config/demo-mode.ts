/**
 * Explicit, isolated development only. Next builds (including previews) are
 * production builds and must never trust a demo identity or return fixtures.
 */
export function isDemoModeEnabled(): boolean {
  return (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test")
    && !process.env.VERCEL_ENV
    && process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}
