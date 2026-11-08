import { z } from "zod";

export const emergencyInputSchema = z.object({
  description: z.string().trim().min(15, "Cuéntanos con más detalle qué está pasando.").max(2000),
  locationLabel: z.string().trim().min(2, "Indica dónde ocurre la emergencia.").max(180),
});

export type EmergencyInput = z.infer<typeof emergencyInputSchema>;
