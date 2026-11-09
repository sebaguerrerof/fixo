import { describe, it, expect } from "vitest";
import { serviceRequestInputSchema } from "./service-request-input";
import { quoteInputSchema } from "./quote-input";
const request = { title: "Solicitud sintética", categoryId: "gasfiteria", description: "Necesito revisar una fuga de agua en la cocina.", locationLabel: "Ñuñoa", priority: "standard", scheduledFor: "" };
const quote = { serviceRequestId: "request", priceClp: 25000, laborClp: 20000, materialsClp: 5000, diagnosticClp: 0, description: "Revisión y reparación de una fuga en la cocina.", estimatedDuration: "2 horas", availableDate: new Date(Date.now() + 86400000).toISOString(), expiresAt: new Date(Date.now() + 172800000).toISOString() };
describe("marketplace server input contracts", () => {
  it.each(["customerId", "status", "assignedTechnicianId", "priceClp"])("rejects request overposting: %s", key => expect(serviceRequestInputSchema.safeParse({ ...request, [key]: "forged" }).success).toBe(false));
  it("rejects invalid date and oversized private address", () => { expect(serviceRequestInputSchema.safeParse({ ...request, scheduledFor: "invalid" }).success).toBe(false); expect(serviceRequestInputSchema.safeParse({ ...request, address: "x".repeat(301) }).success).toBe(false); });
  it("enforces an exact integer CLP breakdown", () => { expect(quoteInputSchema.safeParse(quote).success).toBe(true); expect(quoteInputSchema.safeParse({ ...quote, priceClp: 24999 }).success).toBe(false); expect(quoteInputSchema.safeParse({ ...quote, laborClp: 20000.5 }).success).toBe(false); });
  it("rejects hidden diagnostic charges and quote overposting", () => { expect(quoteInputSchema.safeParse({ ...quote, laborClp: 19000, diagnosticClp: 1000 }).success).toBe(false); expect(quoteInputSchema.safeParse({ ...quote, status: "accepted" }).success).toBe(false); });
});
