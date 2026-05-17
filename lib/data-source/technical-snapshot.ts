import { generateTechnicalAnalysis, type Signal, type TechnicalAnalysisResult } from "@/lib/technical-analysis";
import { getSignalExplanationVi, sortSignalsByPriority } from "@/lib/signals";
import { vi } from "@/lib/i18n/vi";
import type { OHLCV, StockSummary } from "@/types/stock";

export type TechnicalSnapshot = {
  analysis: TechnicalAnalysisResult;
  score: number;
  status: StockSummary["status"];
  signals: Signal[];
  scoreSource: "supabase" | "runtime";
  supabaseScore: number | null;
  runtimeScore: number;
};

export function createTechnicalSnapshot(
  candles: OHLCV[],
  supabaseScore: number | null,
  supabaseSignals: unknown = null,
): TechnicalSnapshot {
  const analysis = generateTechnicalAnalysis(candles);
  const parsedSupabaseSignals = parseSupabaseSignals(supabaseSignals);
  const score = supabaseScore ?? analysis.score;
  const signals = sortSignalsByPriority(parsedSupabaseSignals.length > 0 ? parsedSupabaseSignals : analysis.signals);
  const scoreSource = supabaseScore === null ? "runtime" : "supabase";

  return {
    analysis,
    score,
    status: getScoreStatus(score),
    signals,
    scoreSource,
    supabaseScore,
    runtimeScore: analysis.score,
  };
}

export function debugTechnicalSnapshot(symbol: string, page: "home" | "detail", snapshot: TechnicalSnapshot) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.debug("[technical-score]", {
    symbol,
    page,
    scoreSource: snapshot.scoreSource,
    supabaseScore: snapshot.supabaseScore,
    runtimeScore: snapshot.runtimeScore,
    displayScore: snapshot.score,
  });
}

function parseSupabaseSignals(value: unknown): Signal[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(toSignal).filter((signal): signal is Signal => signal !== null);
}

function toSignal(value: unknown): Signal | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const category = record.category;
  const sentiment = record.sentiment;
  const strength = record.strength;

  if (
    typeof record.code !== "string" ||
    typeof record.labelVi !== "string" ||
    typeof record.descriptionVi !== "string" ||
    !isSignalCategory(category) ||
    !isSignalSentiment(sentiment) ||
    !isSignalStrength(strength) ||
    typeof record.priority !== "number"
  ) {
    return null;
  }

  const fallbackExplanation = getSignalExplanationVi(record.code);

  return {
    code: record.code,
    labelVi: record.labelVi,
    descriptionVi: record.descriptionVi,
    explanationVi:
      typeof record.explanationVi === "string" && record.explanationVi.length > 0
        ? record.explanationVi
        : fallbackExplanation.explanationVi,
    implicationVi:
      typeof record.implicationVi === "string" && record.implicationVi.length > 0
        ? record.implicationVi
        : fallbackExplanation.implicationVi,
    category,
    sentiment,
    strength,
    priority: record.priority,
  };
}

function isSignalCategory(value: unknown): value is Signal["category"] {
  return (
    value === "trend" ||
    value === "momentum" ||
    value === "volume" ||
    value === "volatility" ||
    value === "breakout" ||
    value === "risk" ||
    value === "pattern"
  );
}

function isSignalSentiment(value: unknown): value is Signal["sentiment"] {
  return value === "bullish" || value === "bearish" || value === "neutral";
}

function isSignalStrength(value: unknown): value is Signal["strength"] {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

function getScoreStatus(score: number): StockSummary["status"] {
  if (score >= 70) return vi.score.constructive;
  if (score >= 45) return vi.score.neutral;
  return vi.score.weak;
}
