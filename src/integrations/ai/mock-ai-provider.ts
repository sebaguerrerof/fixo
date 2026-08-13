import { aiAssessmentSchema, type AiAssessmentInput, type AiProvider } from "@/integrations/ai/ai-provider";

export class MockAiProvider implements AiProvider {
  async assessIssue(input: AiAssessmentInput) {
    const description = input.description.toLocaleLowerCase("es-CL");
    const hasWaterRisk = /fuga|agua|cañer|llave|inund/.test(description);
    const hasElectricRisk = /electric|chispa|enchufe|tablero|corte/.test(description);
    const isUrgent = hasWaterRisk || hasElectricRisk || /ahora|urgente|emergencia/.test(description);

    return aiAssessmentSchema.parse({
      suggestedCategoryId: hasWaterRisk ? "gasfiteria" : hasElectricRisk ? "electricidad" : null,
      suggestedSpecialtyId: hasWaterRisk ? "fugas" : hasElectricRisk ? "tableros" : null,
      urgencyLevel: isUrgent ? "urgent" : "standard",
      summary: input.description.trim() || "Solicitud pendiente de más antecedentes.",
      questions: ["¿Cuándo comenzó el problema?", "¿Puedes adjuntar una fotografía si es seguro hacerlo?"],
      safetyFlags: hasElectricRisk ? ["No manipules cables ni tableros húmedos. Corta la energía solo si es seguro hacerlo."] : [],
      confidence: hasWaterRisk || hasElectricRisk ? 0.84 : 0.48,
    });
  }
}
