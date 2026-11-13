import { z } from "zod";

export const serviceRequestInputSchema = z.object({
  operationId: z.string().uuid().optional(),
  address: z.string().trim().max(300).optional(),
  reference: z.string().trim().max(500).optional(),
  preferredSlot: z.string().trim().max(100).optional(),
  complementaryInfo: z.string().trim().max(1000).optional(),
  title: z.string().trim().min(5, "Describe brevemente lo que necesitas.").max(160),
  categoryId: z.string().min(1, "Selecciona un rubro."),
  description: z.string().trim().min(20, "Agrega algunos detalles para recibir mejores respuestas.").max(3000),
  locationLabel: z.string().trim().min(2, "Indica la comuna del servicio.").max(100),
  priority: z.enum(["standard", "urgent"]),
  scheduledFor: z.string().refine(v => !v || (Number.isFinite(Date.parse(v)) && Date.parse(v) > Date.now() && Date.parse(v) < Date.now() + 366 * 86400000), "Selecciona una fecha futura dentro de un año."),
}).strict();

export type ServiceRequestInput = z.infer<typeof serviceRequestInputSchema>;
