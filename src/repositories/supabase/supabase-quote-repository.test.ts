import { afterEach, describe, expect, it, vi } from "vitest";
import { SupabaseQuoteRepository } from "./supabase-quote-repository";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), single: vi.fn() }));
vi.mock("@/integrations/supabase/server-client", () => ({ getSupabaseServerClient: async () => { const query = { select: () => query, eq: () => query, maybeSingle: mocks.single }; return { from: () => query, rpc: mocks.rpc }; } }));
afterEach(() => vi.resetAllMocks());
describe("versioned real quote draft repository", () => {
  it("requires the caller operation and reviewed revision before edits", async () => {
    await expect(new SupabaseQuoteRepository().updateDraft("quote", { priceClp: 30000 })).rejects.toThrow("versión");
    expect(mocks.single).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("updates through the atomic RPC and preserves exact cost components", async () => {
    mocks.single.mockResolvedValue({ data: { id: "quote", service_request_id: "request", technician_id: "technician", labor_clp: 20000, materials_clp: 5000, diagnostic_clp: 0, price_clp: 25000, revision: 3 }, error: null });
    mocks.rpc.mockResolvedValue({ data: { id: "quote", price_clp: 30000, revision: 4 }, error: null });
    await new SupabaseQuoteRepository().updateDraft("quote", { priceClp: 30000, operationId: "operation", expectedRevision: 3 });
    expect(mocks.rpc).toHaveBeenCalledWith("marketplace_save_quote", expect.objectContaining({ request_id: "request", operation_id: "operation", expected_revision: 3, payload: expect.objectContaining({ laborClp: 25000, materialsClp: 5000, diagnosticClp: 0 }) }));
  });
  it("does not retry a provider conflict with a fresh revision", async () => {
    mocks.single.mockResolvedValue({ data: { id: "quote", service_request_id: "request", price_clp: 25000, revision: 4 }, error: null });
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "PT409" } });
    await expect(new SupabaseQuoteRepository().updateDraft("quote", { operationId: "operation", expectedRevision: 3 })).rejects.toThrow("PT409");
    expect(mocks.rpc).toHaveBeenCalledOnce();
  });
});
