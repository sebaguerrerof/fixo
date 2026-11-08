import { isDemoModeEnabled } from "@/config/demo-mode";
import type { AiProvider } from "@/integrations/ai/ai-provider";
import { MockAiProvider } from "@/integrations/ai/mock-ai-provider";

export function getAiProvider(): AiProvider {
  if (isDemoModeEnabled()) return new MockAiProvider();
  // Aún no existe un proveedor de IA real conectado; se deja preparado el contrato.
  throw new Error("No hay un proveedor de IA configurado fuera de Demo Mode todavía.");
}
