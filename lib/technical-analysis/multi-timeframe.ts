import type { MultiTimeframeAnalysis, TechnicalIndicators, TimeframeTrend } from "@/lib/technical-analysis/types";
import type { OHLCV } from "@/types/stock";

export function analyzeMultiTimeframe(
  candles: OHLCV[],
  indicators: TechnicalIndicators,
): MultiTimeframeAnalysis {
  const shortTermTrend = analyzePeriodTrend(candles, 20, indicators.sma20);
  const midTermTrend = analyzePeriodTrend(candles, 50, indicators.sma50);
  const longTermTrend = analyzePeriodTrend(candles, 200, indicators.sma200);
  const alignment = getAlignment([shortTermTrend, midTermTrend, longTermTrend]);

  return {
    shortTermTrend,
    midTermTrend,
    longTermTrend,
    alignment,
    summaryVi: createSummary(shortTermTrend, midTermTrend, longTermTrend, alignment),
  };
}

function analyzePeriodTrend(candles: OHLCV[], period: number, movingAverage: number | null): TimeframeTrend {
  if (candles.length < Math.min(period, 20) || movingAverage === null) {
    return "insufficient";
  }

  const window = candles.slice(-period);
  const latest = window[window.length - 1];
  const first = window[0];
  const midpoint = window[Math.max(0, Math.floor(window.length / 2) - 1)];
  const priceSlope = latest.close - first.close;
  const recentSlope = latest.close - midpoint.close;
  const distanceToAverage = ((latest.close - movingAverage) / movingAverage) * 100;

  if (distanceToAverage > 1 && priceSlope > 0 && recentSlope >= 0) {
    return "bullish";
  }

  if (distanceToAverage < -1 && priceSlope < 0 && recentSlope <= 0) {
    return "bearish";
  }

  return "neutral";
}

function getAlignment(trends: TimeframeTrend[]): MultiTimeframeAnalysis["alignment"] {
  const available = trends.filter((trend) => trend !== "insufficient");

  if (available.length >= 2 && available.every((trend) => trend === "bullish")) {
    return "aligned_bullish";
  }

  if (available.length >= 2 && available.every((trend) => trend === "bearish")) {
    return "aligned_bearish";
  }

  return "mixed";
}

function createSummary(
  shortTermTrend: TimeframeTrend,
  midTermTrend: TimeframeTrend,
  longTermTrend: TimeframeTrend,
  alignment: MultiTimeframeAnalysis["alignment"],
): string {
  if (alignment === "aligned_bullish") {
    return "Các khung thời gian đang đồng thuận tăng, xu hướng nhìn tổng thể khá liền mạch.";
  }

  if (alignment === "aligned_bearish") {
    return "Các khung thời gian đang đồng thuận yếu, cần chờ dấu hiệu cân bằng rõ hơn.";
  }

  return `Ngắn hạn ${getTrendText(shortTermTrend)}, trung hạn ${getTrendText(midTermTrend)}, dài hạn ${getTrendText(longTermTrend)}.`;
}

function getTrendText(trend: TimeframeTrend): string {
  if (trend === "bullish") return "tích cực";
  if (trend === "bearish") return "yếu";
  if (trend === "neutral") return "trung lập";
  return "chưa đủ dữ liệu";
}
