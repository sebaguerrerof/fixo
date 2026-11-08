import { z } from "zod";

export const serviceRequestInputSchema = z.object({
  title: z.string().trim().min(5, "Describe brevemente lo que necesitas.").max(160),
  categoryId: z.string().min(1, "Selecciona un rubro."),
  description: z.string().trim().min(20, "Agrega algunos detalles para recibir mejores respuestas.").max(3000),
  locationLabel: z.string().trim().min(2, "Indica dónde necesitas el servicio.").max(180),
  priority: z.enum(["standard", "urgent"]),
  scheduledFor: z.string(),
});

export type ServiceRequestInput = z.infer<typeof serviceRequestInputSchema>;
