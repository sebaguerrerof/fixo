import { afterEach, describe, expect, it, vi } from "vitest";
import { QuoteService } from "./quote-service";
const mocks = vi.hoisted(() => ({ get: vi.fn(), accept: vi.fn(), request: vi.fn(), job: vi.fn() }));
vi.mock("@/repositories/repository-factory", () => ({ getQuoteRepository: () => ({ getById: mocks.get, acceptAtomically: mocks.accept }), getServiceRequestRepository: mocks.request, getJobRepository: mocks.job }));
afterEach(() => vi.resetAllMocks());
describe("real quote acceptance boundary", () => {
  it("passes the customer-reviewed revision to one atomic operation", async () => {
    mocks.get.mockResolvedValue({ id: "quote", revision: 7 }); const result = { request: {}, quote: {}, job: {} }; mocks.accept.mockResolvedValue(result);
    expect(await new QuoteService().acceptQuote("customer", "request", "quote", 3)).toBe(result);
    expect(mocks.accept).toHaveBeenCalledExactlyOnceWith("request", "quote", 3);
    expect(mocks.job).not.toHaveBeenCalled();
  });
  it("propagates a conflict without attempting another write", async () => {
    mocks.get.mockResolvedValue({ id: "quote", revision: 3 }); mocks.accept.mockRejectedValue(new Error("PT409"));
    await expect(new QuoteService().acceptQuote("customer", "request", "quote", 3)).rejects.toThrow("PT409");
    expect(mocks.accept).toHaveBeenCalledOnce(); expect(mocks.job).not.toHaveBeenCalled();
  });
});
