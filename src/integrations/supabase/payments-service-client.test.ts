import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
vi.mock("server-only", () => ({}));
const createClient = vi.fn(() => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: (...a: unknown[]) => createClient(...(a as [])) }));
import { getPaymentsServiceClient } from "./payments-service-client";
import { PaymentsTargetError } from "@/integrations/payments/payments-target";

const saved = { ...process.env };
beforeEach(() => {
  createClient.mockClear();
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: "https://sandbox-proj.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x", SUPABASE_SERVICE_ROLE_KEY: "service", FIXO_PAYMENTS_SUPABASE_ORIGIN: "https://sandbox-proj.supabase.co" });
  delete process.env.NEXT_PUBLIC_DEMO_MODE;
});
afterEach(() => { for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]; Object.assign(process.env, saved); });

describe("getPaymentsServiceClient", () => {
  it("builds the privileged client only for the authorized project", () => {
    getPaymentsServiceClient(); expect(createClient).toHaveBeenCalledTimes(1);
  });
  it("a different or unauthorized project never creates the client", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://other-proj.supabase.co";
    expect(() => getPaymentsServiceClient()).toThrow(PaymentsTargetError);
    delete process.env.FIXO_PAYMENTS_SUPABASE_ORIGIN; process.env.NEXT_PUBLIC_SUPABASE_URL = "https://sandbox-proj.supabase.co";
    expect(() => getPaymentsServiceClient()).toThrow(PaymentsTargetError);
    expect(createClient).not.toHaveBeenCalled();
  });
});
