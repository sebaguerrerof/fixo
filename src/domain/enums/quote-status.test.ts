import { describe, expect, it } from "vitest";

import { canTransitionQuote } from "@/domain/enums/quote-status";

describe("quote transitions", () => {
  it("allows draft to submitted", () => {
    expect(canTransitionQuote("draft", "submitted")).toBe(true);
  });

  it("allows submitted to accepted", () => {
    expect(canTransitionQuote("submitted", "accepted")).toBe(true);
  });

  it("allows submitted to withdrawn", () => {
    expect(canTransitionQuote("submitted", "withdrawn")).toBe(true);
  });

  it("allows submitted to expired", () => {
    expect(canTransitionQuote("submitted", "expired")).toBe(true);
  });

  it("rejects accepted back to draft", () => {
    expect(canTransitionQuote("accepted", "draft")).toBe(false);
  });

  it("rejects accepted to withdrawn", () => {
    expect(canTransitionQuote("accepted", "withdrawn")).toBe(false);
  });
});
