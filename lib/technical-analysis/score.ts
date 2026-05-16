import type { ScoreBreakdown, TechnicalIndicators } from "@/lib/technical-analysis/types";

export function calculateTechnicalScore(indicators: TechnicalIndicators): {
  score: number;
  breakdown: ScoreBreakdown;
} {
  const trend = scoreTrend(indicators);
  const momentum = scoreMomentum(indicators);
  const volume = scoreVolume(indicators);
  const volatilityBreakout = scoreVolatilityBreakout(indicators);
  const risk = scoreRisk(indicators);
  const score = Math.max(0, Math.min(100, Math.round(trend + momentum + volume + volatilityBreakout + risk)));

  return {
    score,
    breakdown: { trend, momentum, volume, volatilityBreakout, risk },
  };
}

function scoreTrend(indicators: TechnicalIndicators): number {
  let score = 12;
  if (indicators.sma20 && indicators.ema20 && indicators.ema20 >= indicators.sma20) score += 4;
  if (indicators.sma20 && indicators.sma50 && indicators.sma20 > indicators.sma50) score += 8;
  if (indicators.sma50 && indicators.sma200 && indicators.sma50 > indicators.sma200) score += 4;
  if (indicators.goldenCross) score += 6;
  if (indicators.deathCross) score -= 8;
  return clamp(score, 0, 30);
}

function scoreMomentum(indicators: TechnicalIndicators): number {
  let score = 10;
  if (indicators.rsi14 !== null && indicators.rsi14 >= 45 && indicators.rsi14 <= 65) score += 7;
  if (indicators.rsi14 !== null && indicators.rsi14 > 65 && indicators.rsi14 <= 72) score += 4;
  if (indicators.rsi14 !== null && indicators.rsi14 < 35) score -= 5;
  if (indicators.macd.histogram !== null && indicators.macd.histogram > 0) score += 5;
  if (indicators.roc10 !== null && indicators.roc10 > 0) score += 3;
  return clamp(score, 0, 25);
}

function scoreVolume(indicators: TechnicalIndicators): number {
  let score = 8;
  if (indicators.priceUpWithVolumeUp) score += 6;
  if (indicators.breakoutVolumeConfirmation) score += 6;
  if (indicators.heavySellingVolume) score -= 6;
  return clamp(score, 0, 20);
}

function scoreVolatilityBreakout(indicators: TechnicalIndicators): number {
  let score = 7;
  if (indicators.breakHigh20) score += 5;
  if (indicators.pullbackToMA20 || indicators.retestBreakoutZone) score += 3;
  if (indicators.breakLow20) score -= 6;
  if (indicators.bollingerBands20.squeeze) score += 1;
  return clamp(score, 0, 15);
}

function scoreRisk(indicators: TechnicalIndicators): number {
  let score = 10;
  if (indicators.brokenMA20) score -= 3;
  if (indicators.brokenMA50) score -= 5;
  if (indicators.rsiOverbought) score -= 2;
  if (indicators.macdBearish) score -= 2;
  if (indicators.heavySellingVolume) score -= 4;
  return clamp(score, 0, 10);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}
