import { createFallbackTechnicalAnalysis } from "@/lib/ai/fallback-summary";
import { geminiProvider } from "@/lib/ai/gemini-provider";
import { formatTechnicalScore, normalizeTechnicalScore } from "@/lib/ai/score-format";
import type { AiAnalysisSentiment, AiProvider, AiTechnicalAnalysis, AiTechnicalInput } from "@/lib/ai/types";

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
    return alignAnalysisToCanonicalScore(await provider.analyzeTechnical(input), input);
  } catch (error) {
    console.warn(`AI provider ${provider.name} failed:`, error);
    return alignAnalysisToCanonicalScore(createFallbackTechnicalAnalysis(input), input);
  }
}

function alignAnalysisToCanonicalScore(
  analysis: AiTechnicalAnalysis,
  input: AiTechnicalInput,
): AiTechnicalAnalysis {
  const aiSummaryScore = extractScoreFromText(analysis.summary);
  const canonicalScore = normalizeTechnicalScore(input.technicalScore);
  const sentiment = getCanonicalSentiment(input);

  return {
    ...analysis,
    summary: enforceCanonicalScoreText(analysis.summary, canonicalScore),
    bullishPoints: analysis.bullishPoints.map((point) => enforceCanonicalScoreText(point, canonicalScore)),
    riskPoints: analysis.riskPoints.map((point) => enforceCanonicalScoreText(point, canonicalScore)),
    watchPoints: analysis.watchPoints.map((point) => enforceCanonicalScoreText(point, canonicalScore)),
    sentiment,
    technicalScore: canonicalScore,
    scoreSource: input.scoreSource,
    diagnostics: {
      ...analysis.diagnostics,
      aiSummaryScore,
      scoreSource: input.scoreSource,
    },
  };
}

function enforceCanonicalScoreText(value: string, technicalScore: number): string {
  const canonical = formatTechnicalScore(technicalScore);
  const withSlashScore = value.replace(/\b\d{1,}\s*\/\s*100\b/g, canonical);

  return withSlashScore.replace(
    /(điểm kỹ thuật\s+)(\d{1,})(?!\s*\/)/gi,
    (_match, prefix: string) => `${prefix}${normalizeTechnicalScore(technicalScore)}`,
  );
}

function extractScoreFromText(value: string): number | null {
  const slashMatch = value.match(/\b(\d{1,})\s*\/\s*100\b/);

  if (slashMatch) {
    return toScore(slashMatch[1]);
  }

  const textMatch = value.match(/điểm kỹ thuật\s+(\d{1,})(?!\s*\/)/i);
  return textMatch ? toScore(textMatch[1]) : null;
}

function toScore(value: string): number | null {
  const score = Number(value);
  return Number.isInteger(score) && score >= 0 && score <= 100 ? score : null;
}

function getCanonicalSentiment(input: AiTechnicalInput): AiAnalysisSentiment {
  const hasStrongRisk = input.topSignals.some(
    (signal) => signal.sentiment === "bearish" && signal.priority >= 90,
  );

  if (hasStrongRisk || input.technicalScore < 45) {
    return "risk";
  }

  if (input.technicalScore >= 70) {
    return "positive";
  }

  return "neutral";
}
