"use server";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getPaymentRepository } from "@/repositories/repository-factory";
import { getServerAuthenticatedUser } from "@/services/auth/server-authentication-service";
import { PaymentOutcomeUnknownError, PaymentRejectedError, getPaymentService } from "@/services/payments/payment-service";
import { PaymentConflictError, PaymentForbiddenError } from "@/repositories/contracts/payment-repository";
import { PaymentsUnavailableError } from "@/integrations/payments/flow-provider";
import { PaymentRateLimitedError, PaymentRateLimiterUnavailableError } from "@/services/payments/payment-rate-limit";
import { PaymentsTargetError } from "@/integrations/payments/payments-target";

export type StartPaymentResult =
  | { readonly ok: true; readonly checkoutUrl: string; readonly totalClp: number }
  /** `renewKey`: the previous attempt ended definitively, so the next click must use a NEW idempotency key. Ambiguous outcomes keep the key. */
  | { readonly ok: false; readonly message: string; readonly renewKey?: boolean };

/** Only identifiers, the displayed policy version, the consent and an idempotency key come from the browser; amounts never do. */
export async function startPayment(input: unknown): Promise<StartPaymentResult> {
  const user = await getServerAuthenticatedUser(); if (!user) return { ok: false, message: "Inicia sesión antes de continuar." };
  if (user.role !== "customer") return { ok: false, message: "Sólo el cliente del trabajo puede pagar." };
  const raw = typeof input === "object" && input !== null ? input as Record<string, unknown> : {};
  try {
    const result = await getPaymentService().startCheckout({
      jobId: raw.jobId as string, extraChargeId: (raw.extraChargeId ?? null) as string | null, expectedPolicyVersion: raw.expectedPolicyVersion as number,
      consent: raw.consent as true, idempotencyKey: typeof raw.idempotencyKey === "string" ? raw.idempotencyKey : randomUUID(),
    }, { id: user.id, email: user.email });
    revalidatePath("/cliente/trabajos"); if (typeof raw.jobId === "string") revalidatePath("/cliente/trabajos/" + raw.jobId);
    if (result.status === "redirect") return { ok: true, checkoutUrl: result.checkoutUrl, totalClp: result.totalClp };
    if (result.status === "retry_allowed") return { ok: false, renewKey: true, message: "El intento anterior terminó (rechazado o anulado). Pulsa «Pagar» para iniciar uno nuevo." };
    return { ok: false, message: "Tu pago está en proceso de verificación. Actualiza esta página en unos minutos." };
  } catch (error) {
    if (error instanceof PaymentRejectedError) return { ok: false, renewKey: true, message: error.message };
    if (error instanceof PaymentOutcomeUnknownError || error instanceof PaymentConflictError || error instanceof PaymentForbiddenError) return { ok: false, message: error.message };
    if (error instanceof PaymentRateLimitedError) return { ok: false, message: error.message };
    if (error instanceof PaymentRateLimiterUnavailableError || error instanceof PaymentsUnavailableError || error instanceof PaymentsTargetError) return { ok: false, message: "Los pagos no están disponibles por ahora." };
    // Only input validation is the user's to fix; any other failure (e.g. a service misconfiguration) must not blame the customer.
    if (error instanceof z.ZodError) return { ok: false, message: "Revisa el consentimiento y los datos del pago e inténtalo nuevamente." };
    return { ok: false, message: "Los pagos no están disponibles por ahora." };
  }
}

export type RespondExtraResult = { readonly ok: boolean; readonly message: string };
const respondInput = z.object({ extraChargeId: z.string().uuid(), decision: z.enum(["accepted", "rejected"]), expectedPolicyVersion: z.number().int().positive().nullable(), reason: z.string().trim().max(1000).nullable().optional(), jobId: z.string().uuid() })
  .refine((v) => v.decision === "rejected" || v.expectedPolicyVersion !== null);

/** Customer-only. Accepting records the financial consent for the displayed policy version; the DB rejects a stale version. */
export async function respondExtraCharge(input: unknown): Promise<RespondExtraResult> {
  const user = await getServerAuthenticatedUser(); if (!user) return { ok: false, message: "Inicia sesión antes de continuar." };
  if (user.role !== "customer") return { ok: false, message: "Sólo el cliente del trabajo puede responder un adicional." };
  const parsed = respondInput.safeParse(input); if (!parsed.success) return { ok: false, message: "Revisa los datos de tu respuesta." };
  const { extraChargeId, decision, expectedPolicyVersion, reason, jobId } = parsed.data;
  try {
    await getPaymentRepository().respondExtra({ extraChargeId, decision, expectedPolicyVersion: decision === "accepted" ? expectedPolicyVersion : null, reason: reason || null });
    for (const root of ["/cliente/trabajos", "/tecnico/trabajos", "/admin/trabajos"]) { revalidatePath(root); revalidatePath(root + "/" + jobId); }
    return { ok: true, message: decision === "accepted" ? "Adicional aceptado. Ya puedes pagarlo desde el detalle del trabajo." : "Adicional rechazado. No genera ninguna deuda." };
  } catch (error) {
    if (error instanceof PaymentConflictError || error instanceof PaymentForbiddenError) return { ok: false, message: error.message };
    return { ok: false, message: "No pudimos registrar tu respuesta. Actualiza la página antes de reintentar." };
  }
}

const proposeInput = z.object({ jobId: z.string().uuid(), operationId: z.string().uuid(), concept: z.string().trim().min(10).max(500), amountClp: z.number().int().min(1000).max(50_000_000) });
/** Technician-only. A proposal is not a debt: it needs the customer's explicit acceptance of Q/F/T. */
export async function proposeExtraCharge(input: unknown): Promise<RespondExtraResult> {
  const user = await getServerAuthenticatedUser(); if (!user) return { ok: false, message: "Inicia sesión antes de continuar." };
  if (user.role !== "technician") return { ok: false, message: "Sólo el profesional asignado puede proponer un adicional." };
  const parsed = proposeInput.safeParse(input); if (!parsed.success) return { ok: false, message: "Indica un concepto de al menos 10 caracteres y un importe entero entre $1.000 y $50.000.000." };
  try {
    await getPaymentRepository().proposeExtra(parsed.data);
    for (const root of ["/cliente/trabajos", "/tecnico/trabajos", "/admin/trabajos"]) { revalidatePath(root); revalidatePath(root + "/" + parsed.data.jobId); }
    return { ok: true, message: "Adicional propuesto. No es una deuda hasta que el cliente lo acepte." };
  } catch (error) {
    if (error instanceof PaymentConflictError || error instanceof PaymentForbiddenError) return { ok: false, message: error.message };
    return { ok: false, message: "No pudimos registrar el adicional. Actualiza la página antes de reintentar." };
  }
}

const policyInput = z.object({ expectedVersion: z.number().int().positive(), basisPoints: z.number().int().min(0).max(2000), reason: z.string().trim().min(10).max(1000) });
/** Superadmin only (also enforced by the DB). Creates a new immutable version; existing orders, their retries and history are never recalculated. */
export async function updateFeePolicy(input: unknown): Promise<RespondExtraResult> {
  const user = await getServerAuthenticatedUser(); if (!user) return { ok: false, message: "Inicia sesión antes de continuar." };
  if (user.role !== "superadmin") return { ok: false, message: "Sólo un superadministrador puede cambiar la comisión." };
  const parsed = policyInput.safeParse(input); if (!parsed.success) return { ok: false, message: "Indica un porcentaje entre 0 % y 20 % y un motivo de al menos 10 caracteres." };
  try {
    await getPaymentRepository().setPolicy(parsed.data); revalidatePath("/admin/configuracion");
    return { ok: true, message: "Porcentaje actualizado. Se aplica sólo a órdenes nuevas; las existentes conservan su desglose." };
  } catch (error) {
    if (error instanceof PaymentConflictError || error instanceof PaymentForbiddenError) return { ok: false, message: error.message };
    return { ok: false, message: "No pudimos actualizar el porcentaje. Actualiza la página antes de reintentar." };
  }
}

/** Superadmin only. Only schedules a provider re-check; it can never mark a payment as paid. */
export async function requestPaymentReconciliation(input: unknown): Promise<RespondExtraResult> {
  const user = await getServerAuthenticatedUser(); if (!user) return { ok: false, message: "Inicia sesión antes de continuar." };
  if (user.role !== "superadmin") return { ok: false, message: "Sólo un superadministrador puede solicitar una verificación." };
  const parsed = z.object({ attemptId: z.string().uuid() }).safeParse(input); if (!parsed.success) return { ok: false, message: "Intento inválido." };
  try { await getPaymentRepository().requestReconciliation(parsed.data.attemptId); revalidatePath("/admin/configuracion"); return { ok: true, message: "Verificación programada. El resultado lo decide el proveedor, no esta acción." }; }
  catch (error) {
    if (error instanceof PaymentConflictError || error instanceof PaymentForbiddenError) return { ok: false, message: error.message };
    return { ok: false, message: "No pudimos programar la verificación." };
  }
}
