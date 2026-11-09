"use server";

import { quoteInputSchema, type QuoteInput } from "@/domain/validation/quote-input";
import { QuoteService } from "@/services/quotes/quote-service";
import { getServerAuthenticatedUser } from "@/services/auth/server-authentication-service";
import { isDemoModeEnabled } from "@/config/demo-mode";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export interface SubmitQuoteResult {
  readonly ok: boolean;
  readonly message?: string;
  readonly revision?: number;
}

async function requireTechnicianId(): Promise<string | null> {
  const user = await getServerAuthenticatedUser();
  return user?.role === "technician" ? user.id : null;
}

export async function createAndSubmitQuote(input: QuoteInput): Promise<SubmitQuoteResult> {
  const technicianId = await requireTechnicianId();
  if (!technicianId) return { ok: false, message: "unauthenticated" };

  const parsed = quoteInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Revisa los datos de tu cotización." };
  if (!isDemoModeEnabled() && (!parsed.data.operationId || !z.string().uuid().safeParse(parsed.data.serviceRequestId).success)) return { ok: false, message: "Actualiza la oportunidad antes de cotizar." };

  try {
    const service = new QuoteService();
    const draft = await service.createDraft(technicianId, parsed.data);
    await service.submitDraft(technicianId, draft.id);
    revalidatePath("/tecnico/oportunidades");
    return { ok: true };
  } catch {
    return { ok: false, message: "No pudimos enviar. Actualiza la oportunidad para comprobar el estado de tu propuesta y tu habilitación." };
  }
}

export async function saveQuoteDraft(input: QuoteInput): Promise<SubmitQuoteResult> {
  const technicianId = await requireTechnicianId();
  if (!technicianId) return { ok: false, message: "unauthenticated" };

  const parsed = quoteInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Revisa los datos de tu cotización." };
  if (!isDemoModeEnabled() && (!parsed.data.operationId || !z.string().uuid().safeParse(parsed.data.serviceRequestId).success)) return { ok: false, message: "Actualiza la oportunidad antes de cotizar." };

  try {
    const draft = await new QuoteService().createDraft(technicianId, parsed.data);
    return { ok: true, revision: draft.revision };
  } catch {
    return { ok: false, message: "No pudimos guardar el borrador. Actualiza la oportunidad para comprobar su versión y tu habilitación." };
  }
}

export async function withdrawQuote(id: string): Promise<SubmitQuoteResult> {
  const actor = await requireTechnicianId(); if (!actor || !z.string().uuid().safeParse(id).success) return { ok: false, message: "Cotización no disponible." };
  try { await new QuoteService().withdraw(actor, id); revalidatePath("/tecnico/oportunidades"); return { ok: true }; }
  catch { return { ok: false, message: "No pudimos retirar la propuesta. Actualiza la oportunidad." }; }
}
