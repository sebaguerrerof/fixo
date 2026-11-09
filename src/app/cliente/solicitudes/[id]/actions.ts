"use server";

import { revalidatePath } from "next/cache";

import { getServerAuthenticatedUser } from "@/services/auth/server-authentication-service";
import { QuoteService } from "@/services/quotes/quote-service";
import { z } from "zod";
import { getServiceRequestRepository } from "@/repositories/repository-factory";

export interface AcceptQuoteActionResult {
  readonly ok: boolean;
  readonly message?: string;
}

export async function acceptQuoteAction(serviceRequestId: string, quoteId: string, expectedRevision: number): Promise<AcceptQuoteActionResult> {
  const user = await getServerAuthenticatedUser();
  if (!user || user.role !== "customer") return { ok: false, message: "unauthenticated" };
  if (!z.string().uuid().safeParse(serviceRequestId).success || !z.string().uuid().safeParse(quoteId).success) return { ok: false, message: "Identificadores inválidos." };
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) return { ok: false, message: "Actualiza la cotización antes de seleccionarla." };

  try {
    await new QuoteService().acceptQuote(user.id, serviceRequestId, quoteId, expectedRevision);
    revalidatePath(`/cliente/solicitudes/${serviceRequestId}`);
    revalidatePath("/cliente");
    return { ok: true };
  } catch {
    return { ok: false, message: "No pudimos adjudicar. Actualiza la solicitud: la propuesta puede haber cambiado, vencido o perdido habilitación." };
  }
}

export async function cancelServiceRequest(id: string, revision: number): Promise<AcceptQuoteActionResult> {
  const user = await getServerAuthenticatedUser();
  if (!user || user.role !== "customer") return { ok: false, message: "unauthenticated" };
  if (!z.string().uuid().safeParse(id).success || !Number.isSafeInteger(revision) || revision < 1) return { ok: false, message: "Solicitud inválida." };
  try { const repository = getServiceRequestRepository(); if (!repository.cancel) throw new Error(); await repository.cancel(id, revision);
    revalidatePath(`/cliente/solicitudes/${id}`); revalidatePath("/cliente"); return { ok: true };
  } catch { return { ok: false, message: "No pudimos cancelar. Actualiza la solicitud; puede haber cambiado o estar adjudicada." }; }
}
