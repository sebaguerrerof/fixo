import { describe, it, expect } from "vitest";
import { assertAuthorizedPaymentsTarget, PaymentsTargetError } from "./payments-target";

const ok = { FIXO_PAYMENTS_SUPABASE_ORIGIN: "https://sandbox-proj.supabase.co", NEXT_PUBLIC_SUPABASE_URL: "https://sandbox-proj.supabase.co" };
describe("assertAuthorizedPaymentsTarget", () => {
  it("accepts only the exact authorized origin", () => {
    expect(() => assertAuthorizedPaymentsTarget(ok)).not.toThrow();
    expect(() => assertAuthorizedPaymentsTarget({ ...ok, NEXT_PUBLIC_SUPABASE_URL: "https://sandbox-proj.supabase.co/" })).not.toThrow();
  });
  it("blocks a different project, a missing authorization and malformed values", () => {
    for (const env of [
      { ...ok, NEXT_PUBLIC_SUPABASE_URL: "https://other-proj.supabase.co" },
      { ...ok, NEXT_PUBLIC_SUPABASE_URL: "https://sandbox-proj.supabase.co.evil.example" },
      { ...ok, NEXT_PUBLIC_SUPABASE_URL: "http://sandbox-proj.supabase.co" },
      { NEXT_PUBLIC_SUPABASE_URL: ok.NEXT_PUBLIC_SUPABASE_URL }, { FIXO_PAYMENTS_SUPABASE_ORIGIN: ok.FIXO_PAYMENTS_SUPABASE_ORIGIN }, {},
      { ...ok, FIXO_PAYMENTS_SUPABASE_ORIGIN: "https://sandbox-proj.supabase.co/path" }, { ...ok, FIXO_PAYMENTS_SUPABASE_ORIGIN: "nope" },
    ]) expect(() => assertAuthorizedPaymentsTarget(env)).toThrow(PaymentsTargetError);
  });
});
