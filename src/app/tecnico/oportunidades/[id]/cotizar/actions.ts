"use server";

import { quoteInputSchema, type QuoteInput } from "@/domain/validation/quote-input";
import { QuoteService } from "@/services/quotes/quote-service";
import { getServerAuthenticatedUser } from "@/services/auth/server-authentication-service";

export interface SubmitQuoteResult {
  readonly ok: boolean;
  readonly message?: string;
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

  try {
    const service = new QuoteService();
    const draft = await service.createDraft(technicianId, parsed.data);
    await service.submitDraft(technicianId, draft.id);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No pudimos enviar tu cotización." };
  }
}

export async function saveQuoteDraft(input: QuoteInput): Promise<SubmitQuoteResult> {
  const technicianId = await requireTechnicianId();
  if (!technicianId) return { ok: false, message: "unauthenticated" };

  const parsed = quoteInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Revisa los datos de tu cotización." };

  try {
    await new QuoteService().createDraft(technicianId, parsed.data);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No pudimos guardar el borrador." };
  }
}
