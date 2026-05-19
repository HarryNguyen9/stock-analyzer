import type { OHLCV } from "@/types/stock";

export type SignalCategory =
  | "trend"
  | "momentum"
  | "volume"
  | "volatility"
  | "breakout"
  | "risk"
  | "pattern";

export type SignalSentiment = "bullish" | "bearish" | "neutral";

export type Signal = {
  code: string;
  labelVi: string;
  descriptionVi: string;
  explanationVi: string;
  implicationVi: string;
  category: SignalCategory;
  sentiment: SignalSentiment;
  strength: 1 | 2 | 3 | 4 | 5;
  priority: number;
};

export type MacdSnapshot = {
  macd: number | null;
  signal: number | null;
  histogram: number | null;
};

export type BollingerBandsSnapshot = {
  upper: number | null;
  middle: number | null;
  lower: number | null;
  width: number | null;
  squeeze: boolean;
};

export type TechnicalIndicators = {
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
  goldenCross: boolean;
  deathCross: boolean;
  rsi14: number | null;
  macd: MacdSnapshot;
  roc10: number | null;
  adx14: number | null;
  obv: number | null;
  stochasticRsi: number | null;
  volumeAverage20: number | null;
  volumeSpikeRatio: number | null;
  priceUpWithVolumeUp: boolean;
  breakoutVolumeConfirmation: boolean;
  bollingerBands20: BollingerBandsSnapshot;
  atr14: number | null;
  breakHigh20: boolean;
  breakLow20: boolean;
  pullbackToMA20: boolean;
  retestBreakoutZone: boolean;
  brokenMA20: boolean;
  brokenMA50: boolean;
  rsiOverbought: boolean;
  macdBearish: boolean;
  heavySellingVolume: boolean;
  higherHighHigherLow: boolean;
  lowerHighLowerLow: boolean;
  consolidationRange: boolean;
  gapUp: boolean;
  gapDown: boolean;
};

export type CandlestickPatterns = {
  doji: boolean;
  hammer: boolean;
  bullishEngulfing: boolean;
  bearishEngulfing: boolean;
  shootingStar: boolean;
};

export type PatternConfidence = "low" | "medium" | "high";

export type CandlestickPatternName =
  | "doji"
  | "hammer"
  | "shooting-star"
  | "bullish-engulfing"
  | "bearish-engulfing"
  | "morning-star"
  | "evening-star"
  | "marubozu";

export type DojiType = "standard" | "long-legged" | "dragonfly" | "gravestone";

export type CandlestickPatternSignal = {
  pattern: CandlestickPatternName;
  labelVi: string;
  dojiType?: DojiType;
  sentiment: SignalSentiment;
  confidence: PatternConfidence;
  descriptionVi: string;
  contextNotes?: string[];
  summaryVi?: string;
  detectedAt: string;
};

export type WyckoffPhaseGuess =
  | "accumulation"
  | "markup"
  | "distribution"
  | "markdown"
  | "range"
  | "unclear";

export type WyckoffLiteAnalysis = {
  phaseGuess: WyckoffPhaseGuess;
  confidence: PatternConfidence;
  evidence: string[];
  invalidationNotes: string[];
  summaryVi: string;
};

export type PriceBehaviorAnalysis = {
  candlestickPatterns: CandlestickPatternSignal[];
  wyckoffLite: WyckoffLiteAnalysis;
};

export type MarketStructure = {
  structureType: "uptrend" | "downtrend" | "range" | "transition" | "unclear";
  shortTermBias: SignalSentiment;
  keySwingHigh: number | null;
  keySwingLow: number | null;
  lastBreakType: "breakout" | "breakdown" | "none";
  summaryVi: string;
};

export type TimeframeTrend = "bullish" | "neutral" | "bearish" | "insufficient";

export type MultiTimeframeAnalysis = {
  shortTermTrend: TimeframeTrend;
  midTermTrend: TimeframeTrend;
  longTermTrend: TimeframeTrend;
  alignment: "aligned_bullish" | "aligned_bearish" | "mixed";
  summaryVi: string;
};

export type TrendQualityAnalysis = {
  quality: "clean" | "choppy" | "weak" | "volatile";
  score: number;
  reasons: string[];
  summaryVi: string;
};

export type PriceActionCore = {
  marketStructure: MarketStructure;
  multiTimeframe: MultiTimeframeAnalysis;
  trendQuality: TrendQualityAnalysis;
};

export type SupportResistance = {
  nearestSupport: number | null;
  nearestResistance: number | null;
  high20: number | null;
  low20: number | null;
  high50: number | null;
  low50: number | null;
  distanceToSupportPercent: number | null;
  distanceToResistancePercent: number | null;
};

export type MethodSummary = {
  key: "trend" | "momentum" | "volume" | "volatility" | "supportResistance" | "patterns";
  titleVi: string;
  conclusionVi: string;
  tone: SignalSentiment;
  items: Array<{
    label: string;
    value: string;
  }>;
};

export type TechnicalSetupType =
  | "breakout"
  | "pullback"
  | "accumulation"
  | "downtrend"
  | "range-bound"
  | "high-risk";

export type TechnicalThesis = {
  setupType: TechnicalSetupType;
  trendBias: SignalSentiment;
  keySupport: number | null;
  keyResistance: number | null;
  invalidationLevel: number | null;
  conditionsToImprove: string[];
  keyRisks: string[];
  shortSummaryVi: string;
};

export type ScoreBreakdown = {
  trend: number;
  momentum: number;
  volume: number;
  volatilityBreakout: number;
  risk: number;
};

export type TechnicalAnalysisResult = {
  indicators: TechnicalIndicators;
  patterns: CandlestickPatterns;
  priceBehavior: PriceBehaviorAnalysis;
  priceAction: PriceActionCore;
  supportResistance: SupportResistance;
  methodSummaries: MethodSummary[];
  thesis: TechnicalThesis;
  signals: Signal[];
  score: number;
  scoreBreakdown: ScoreBreakdown;
  summaryVi: string;
};

export type AnalysisContext = {
  candles: OHLCV[];
  latest: OHLCV;
  previous: OHLCV;
  closes: number[];
  highs: number[];
  lows: number[];
  volumes: number[];
};
