import type { AiAssessment, AiAssessmentInput, AiProvider } from "@/integrations/ai/ai-provider";
import { aiAssessmentSchema } from "@/integrations/ai/ai-provider";
import { DEMO_CATEGORY_IDS } from "@/repositories/mock/fixtures/categories";

const DANGER_KEYWORDS = ["gas", "monóxido", "monoxido", "incendio", "fuego", "humo", "electrocut", "chispa", "explosion", "explosión"];

const CATEGORY_KEYWORDS: Record<string, readonly string[]> = {
  "cat-electricidad": ["luz", "electric", "cortocircuito", "tablero", "enchufe", "chispa"],
  "cat-gasfiteria": ["agua", "fuga", "cañer", "caner", "calefont", "gas", "wc", "baño"],
  "cat-cerrajeria": ["cerradura", "llave", "puerta", "candado"],
  "cat-climatizacion": ["aire acondicionado", "calefacción", "calefaccion", "refrigerador", "split"],
  "cat-computacion": ["internet", "red", "wifi", "computador", "cámara", "camara"],
  "cat-electrodomesticos": ["lavadora", "horno", "cocina", "microondas"],
  "cat-pintura": ["pintura", "muro", "pared"],
  "cat-jardineria": ["jardín", "jardin", "poda", "pasto"],
};

function normalise(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function guessCategory(description: string): string | null {
  const haystack = normalise(description);
  for (const categoryId of DEMO_CATEGORY_IDS) {
    const keywords = CATEGORY_KEYWORDS[categoryId] ?? [];
    if (keywords.some((keyword) => haystack.includes(normalise(keyword)))) return categoryId;
  }
  return null;
}

function guessSafetyFlags(description: string): string[] {
  const haystack = normalise(description);
  const flags = DANGER_KEYWORDS.filter((keyword) => haystack.includes(normalise(keyword)));
  return [...new Set(flags)];
}

/**
 * Orientación simulada para Demo Mode: heurística por palabras clave, sin
 * dependencias externas. La IA nunca sugiere maniobras riesgosas: si detecta
 * señales de peligro, sólo advierte y prioriza la urgencia.
 */
export class MockAiProvider implements AiProvider {
  async assessIssue(input: AiAssessmentInput): Promise<AiAssessment> {
    const safetyFlags = guessSafetyFlags(input.description);
    const suggestedCategoryId = guessCategory(input.description);
    const isDangerous = safetyFlags.length > 0;

    const assessment: AiAssessment = {
      suggestedCategoryId,
      suggestedSpecialtyId: null,
      urgencyLevel: "urgent",
      summary: isDangerous
        ? "Describes una situación con riesgo potencial. No intentes manipular la fuente del problema: prioriza tu seguridad mientras te conectamos con un técnico."
        : "Registramos tu problema y buscaremos un técnico disponible para atenderlo lo antes posible.",
      questions: isDangerous
        ? ["¿Todas las personas están en un lugar seguro?", "¿Puedes alejarte de la fuente del riesgo mientras esperas?"]
        : ["¿Desde cuándo ocurre el problema?", "¿Hay algún acceso especial para llegar al lugar?"],
      safetyFlags,
      confidence: suggestedCategoryId ? 0.7 : 0.4,
    };

    return aiAssessmentSchema.parse(assessment);
  }
}
