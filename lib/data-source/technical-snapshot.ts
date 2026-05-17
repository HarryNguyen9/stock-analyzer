import { generateTechnicalAnalysis, type Signal, type TechnicalAnalysisResult } from "@/lib/technical-analysis";
import { sortSignalsByPriority } from "@/lib/signals";
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

  return value.filter(isSignal);
}

function isSignal(value: unknown): value is Signal {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "labelVi" in value &&
    "descriptionVi" in value &&
    "category" in value &&
    "sentiment" in value &&
    "strength" in value &&
    "priority" in value &&
    typeof value.code === "string" &&
    typeof value.labelVi === "string" &&
    typeof value.descriptionVi === "string" &&
    typeof value.category === "string" &&
    typeof value.sentiment === "string" &&
    typeof value.strength === "number" &&
    typeof value.priority === "number"
  );
}

function getScoreStatus(score: number): StockSummary["status"] {
  if (score >= 70) return vi.score.constructive;
  if (score >= 45) return vi.score.neutral;
  return vi.score.weak;
}
