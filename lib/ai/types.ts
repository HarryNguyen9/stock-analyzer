import type {
  MethodSummary,
  Signal,
  SupportResistance,
  TechnicalIndicators,
  TechnicalThesis,
} from "@/lib/technical-analysis/types";
import type { StockMetadata } from "@/types/stock";

export type AiAnalysisSentiment = "positive" | "neutral" | "risk";

export type AiScoreBreakdownInput = {
  trend: number;
  momentum: number;
  volume: number;
  volatilityBreakout: number;
  risk: number;
};

export type AiTechnicalInput = {
  symbol: string;
  metadata: StockMetadata;
  latestPrice: number;
  changePercent: number;
  technicalScore: number;
  scoreSource: "supabase" | "runtime";
  scoreBreakdown: AiScoreBreakdownInput;
  advancedIndicators: Pick<
    TechnicalIndicators,
    "ema20" | "ema50" | "ema200" | "macd" | "adx14" | "obv" | "stochasticRsi" | "bollingerBands20" | "atr14"
  >;
  supportResistance: SupportResistance;
  methodSummaries: Pick<MethodSummary, "key" | "titleVi" | "conclusionVi" | "tone">[];
  technicalThesis: TechnicalThesis;
  status: string;
  topSignals: Pick<Signal, "code" | "labelVi" | "descriptionVi" | "sentiment" | "strength" | "priority">[];
  dataUpdatedAt: string | null;
};

export type AiTechnicalAnalysis = {
  summary: string;
  bullishPoints: string[];
  riskPoints: string[];
  watchPoints: string[];
  disclaimer: string;
  sentiment: AiAnalysisSentiment;
  source: "gemini" | "fallback";
  technicalScore: number;
  scoreSource: AiTechnicalInput["scoreSource"];
  diagnostics?: {
    aiSummaryScore: number | null;
    modelUsed?: string | null;
    fallbackModelUsed?: boolean;
    providerErrorStatus?: number | null;
    cacheHit?: boolean;
    scoreSource?: AiTechnicalInput["scoreSource"];
  };
};

export type AiProvider = {
  name: string;
  analyzeTechnical(input: AiTechnicalInput): Promise<AiTechnicalAnalysis>;
};
