import { z } from "zod";

export const quoteInputSchema = z.object({
  serviceRequestId: z.string().min(1, "Falta la solicitud asociada."),
  priceClp: z.coerce.number().int().min(1000, "Ingresa un precio válido.").max(50000000),
  description: z.string().trim().min(20, "Describe brevemente el trabajo a realizar.").max(2000),
  materialsIncluded: z.string().trim().max(600).default(""),
  materialsNotIncluded: z.string().trim().max(600).default(""),
  diagnosticVisit: z.boolean().default(false),
  estimatedDuration: z.string().trim().min(2, "Indica un tiempo estimado.").max(120),
  availableDate: z.string().min(1, "Selecciona una fecha disponible."),
  conditions: z.string().trim().max(600).default(""),
  expiresAt: z.string().min(1, "Selecciona una fecha de expiración."),
});

export type QuoteInput = z.infer<typeof quoteInputSchema>;
