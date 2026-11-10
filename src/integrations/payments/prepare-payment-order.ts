import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { Job } from "@/domain/entities/job";
import type { PaymentOrder } from "@/domain/entities/payment-order";
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b, "en")).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value);
}
/** Caller must load the authorized DB job on the server. No browser amount or commission input exists. */
export function preparePaymentOrder(job: Job, orderId: string, environment: PaymentOrder["environment"], createdAt: string): PaymentOrder {
  const snapshot = job.snapshot;
  for (const id of [job.id, job.customerId, job.quoteId, orderId]) z.string().uuid().parse(id);
  if (!snapshot || snapshot.currency !== "CLP" || !Number.isSafeInteger(snapshot.priceClp) || snapshot.priceClp <= 0 || snapshot.quoteId !== job.quoteId || snapshot.serviceRequestId !== job.serviceRequestId || snapshot.technicianId !== job.technicianId || ["cancelled", "disputed", "completed"].includes(job.status)) throw new Error("El contrato del trabajo no permite preparar una orden.");
  z.enum(["sandbox", "production"]).parse(environment); z.iso.datetime({ offset: true }).parse(createdAt);
  return Object.freeze({ id: orderId, jobId: job.id, quoteId: job.quoteId!, customerId: job.customerId, commerceReference: `fixo-${environment}-${orderId}`, snapshotSha256: createHash("sha256").update(canonical(snapshot)).digest("hex"), amountClp: snapshot.priceClp, currency: "CLP", status: "pending", provider: "flow", environment, createdAt });
}
