import { z } from "zod";

export const quoteInputSchema = z.object({
  operationId: z.string().uuid().optional(),
  expectedRevision: z.number().int().min(0).optional(),
  laborClp: z.coerce.number().int().min(0).max(50000000).optional(),
  materialsClp: z.coerce.number().int().min(0).max(50000000).optional(),
  diagnosticClp: z.coerce.number().int().min(0).max(50000000).optional(),
  serviceRequestId: z.string().min(1, "Falta la solicitud asociada."),
  priceClp: z.coerce.number().int().min(1000, "Ingresa un precio válido.").max(50000000),
  description: z.string().trim().min(20, "Describe brevemente el trabajo a realizar.").max(2000),
  materialsIncluded: z.string().trim().max(600).default(""),
  materialsNotIncluded: z.string().trim().max(600).default(""),
  diagnosticVisit: z.boolean().default(false),
  estimatedDuration: z.string().trim().min(2, "Indica un tiempo estimado.").max(120),
  availableDate: z.string().refine(v => Number.isFinite(Date.parse(v)) && Date.parse(v) > Date.now() && Date.parse(v) < Date.now() + 366 * 86400000, "Selecciona una disponibilidad futura."),
  conditions: z.string().trim().max(600).default(""),
  expiresAt: z.string().refine(v => Number.isFinite(Date.parse(v)) && Date.parse(v) > Date.now() && Date.parse(v) <= Date.now() + 30 * 86400000, "La vigencia debe ser futura y de hasta 30 días."),
}).strict().refine(v => v.laborClp === undefined || v.priceClp === v.laborClp + (v.materialsClp ?? 0) + (v.diagnosticClp ?? 0), { message: "El total debe coincidir con el desglose.", path: ["priceClp"] }).refine(v => v.diagnosticVisit || !v.diagnosticClp, { message: "Activa la visita de diagnóstico para incluir su costo.", path: ["diagnosticClp"] });

export type QuoteInput = z.infer<typeof quoteInputSchema>;
export type QuoteFormInput = z.input<typeof quoteInputSchema>;
