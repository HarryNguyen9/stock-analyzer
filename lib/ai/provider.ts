import { createFallbackTechnicalAnalysis } from "@/lib/ai/fallback-summary";
import { geminiProvider } from "@/lib/ai/gemini-provider";
import type { AiProvider, AiTechnicalAnalysis, AiTechnicalInput } from "@/lib/ai/types";

const fallbackProvider: AiProvider = {
  name: "fallback",
  async analyzeTechnical(input) {
    return createFallbackTechnicalAnalysis(input);
  },
};

export function getAiProvider(): AiProvider {
  if (process.env.AI_PROVIDER === "gemini") {
    return geminiProvider;
  }

  return fallbackProvider;
}

export async function analyzeWithAiProvider(input: AiTechnicalInput): Promise<AiTechnicalAnalysis> {
  const provider = getAiProvider();

  try {
    return await provider.analyzeTechnical(input);
  } catch (error) {
    console.warn(`AI provider ${provider.name} failed:`, error);
    return createFallbackTechnicalAnalysis(input);
  }
}
