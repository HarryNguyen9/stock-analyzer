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
  goldenCross: boolean;
  deathCross: boolean;
  rsi14: number | null;
  macd: MacdSnapshot;
  roc10: number | null;
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

export type ScoreBreakdown = {
  trend: number;
  momentum: number;
  volume: number;
  volatilityBreakout: number;
  risk: number;
};

export type TechnicalAnalysisResult = {
  indicators: TechnicalIndicators;
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
