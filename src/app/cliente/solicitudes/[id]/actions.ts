"use server";

import { revalidatePath } from "next/cache";

import { getServerAuthenticatedUser } from "@/services/auth/server-authentication-service";
import { QuoteService } from "@/services/quotes/quote-service";

export interface AcceptQuoteActionResult {
  readonly ok: boolean;
  readonly message?: string;
}

export async function acceptQuoteAction(serviceRequestId: string, quoteId: string): Promise<AcceptQuoteActionResult> {
  const user = await getServerAuthenticatedUser();
  if (!user || user.role !== "customer") return { ok: false, message: "unauthenticated" };

  try {
    await new QuoteService().acceptQuote(user.id, serviceRequestId, quoteId);
    revalidatePath(`/cliente/solicitudes/${serviceRequestId}`);
    revalidatePath("/cliente");
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No pudimos aceptar esta cotización." };
  }
}
