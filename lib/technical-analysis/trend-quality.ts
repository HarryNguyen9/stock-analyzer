import type { TechnicalIndicators, TrendQualityAnalysis } from "@/lib/technical-analysis/types";
import type { OHLCV } from "@/types/stock";

export function analyzeTrendQuality(candles: OHLCV[], indicators: TechnicalIndicators): TrendQualityAnalysis {
  if (candles.length < 20 || indicators.sma20 === null) {
    return {
      quality: "weak",
      score: 35,
      reasons: ["Chưa có đủ dữ liệu để đánh giá chất lượng xu hướng ổn định."],
      summaryVi: "Chất lượng xu hướng chưa rõ vì dữ liệu còn thiếu.",
    };
  }

  const recent = candles.slice(-50);
  const latest = recent[recent.length - 1];
  const scoreParts = [
    scoreAboveAverage(recent, indicators.sma20, 20),
    scoreAboveAverage(recent, indicators.sma50, 20),
    scoreSlope(recent),
    scoreWhipsaw(recent, indicators.sma20),
    scoreVolatility(latest.close, indicators.atr14),
    scoreAdx(indicators.adx14),
  ];
  const score = clamp(Math.round(scoreParts.reduce((total, item) => total + item, 0)), 0, 100);
  const reasons = createReasons(recent, indicators, score);
  const quality = getQuality(score, latest.close, indicators);

  return {
    quality,
    score,
    reasons,
    summaryVi: createSummary(quality, score),
  };
}

function scoreAboveAverage(candles: OHLCV[], movingAverage: number | null, weight: number): number {
  if (movingAverage === null) return weight * 0.35;
  const last20 = candles.slice(-20);
  const aboveCount = last20.filter((candle) => candle.close >= movingAverage).length;
  return (aboveCount / last20.length) * weight;
}

function scoreSlope(candles: OHLCV[]): number {
  const first = candles[0];
  const latest = candles[candles.length - 1];
  const changePercent = ((latest.close - first.close) / first.close) * 100;

  if (changePercent >= 8) return 18;
  if (changePercent >= 2) return 14;
  if (changePercent > -2) return 9;
  return 4;
}

function scoreWhipsaw(candles: OHLCV[], sma20: number): number {
  const whipsaws = countWhipsaws(candles.slice(-20), sma20);

  if (whipsaws <= 2) return 15;
  if (whipsaws <= 5) return 9;
  return 3;
}

function scoreVolatility(latestClose: number, atr14: number | null): number {
  if (atr14 === null || latestClose <= 0) return 8;
  const atrPercent = (atr14 / latestClose) * 100;

  if (atrPercent <= 3.5) return 12;
  if (atrPercent <= 6) return 8;
  return 3;
}

function scoreAdx(adx14: number | null): number {
  if (adx14 === null) return 7;
  if (adx14 >= 25) return 15;
  if (adx14 >= 18) return 10;
  return 5;
}

function countWhipsaws(candles: OHLCV[], sma20: number): number {
  let whipsaws = 0;
  let previousSide: "above" | "below" | null = null;

  for (const candle of candles) {
    const side = candle.close >= sma20 ? "above" : "below";

    if (previousSide !== null && side !== previousSide) {
      whipsaws += 1;
    }

    previousSide = side;
  }

  return whipsaws;
}

function createReasons(candles: OHLCV[], indicators: TechnicalIndicators, score: number): string[] {
  const latest = candles[candles.length - 1];
  const reasons: string[] = [];

  if (indicators.sma20 !== null) {
    const sma20 = indicators.sma20;
    const last20 = candles.slice(-20);
    const aboveRatio = last20.filter((candle) => candle.close >= sma20).length / last20.length;
    reasons.push(`${Math.round(aboveRatio * 100)}% số phiên gần đây đóng cửa trên MA20.`);
  }

  if (indicators.sma50 !== null) {
    reasons.push(latest.close >= indicators.sma50 ? "Giá vẫn nằm trên MA50." : "Giá chưa lấy lại được MA50.");
  }

  if (indicators.atr14 !== null && latest.close > 0) {
    const atrPercent = (indicators.atr14 / latest.close) * 100;
    reasons.push(`ATR quanh ${atrPercent.toFixed(1)}%, biến động ${atrPercent > 6 ? "khá cao" : "trong vùng kiểm soát"}.`);
  }

  if (indicators.adx14 !== null) {
    reasons.push(`ADX ở mức ${indicators.adx14.toFixed(1)}, ${indicators.adx14 >= 25 ? "xu hướng có lực" : "xu hướng chưa thật mạnh"}.`);
  }

  if (reasons.length === 0) {
    reasons.push(score >= 60 ? "Giá đang giữ cấu trúc tương đối ổn định." : "Xu hướng còn nhiễu, cần thêm xác nhận.");
  }

  return reasons.slice(0, 4);
}

function getQuality(score: number, latestClose: number, indicators: TechnicalIndicators): TrendQualityAnalysis["quality"] {
  const atrPercent = indicators.atr14 !== null && latestClose > 0 ? (indicators.atr14 / latestClose) * 100 : null;

  if (atrPercent !== null && atrPercent > 7) return "volatile";
  if (score >= 72) return "clean";
  if (score >= 50) return "choppy";
  return "weak";
}

function createSummary(quality: TrendQualityAnalysis["quality"], score: number): string {
  if (quality === "clean") {
    return `Xu hướng khá sạch với điểm chất lượng ${score}/100, ít nhiễu hơn trong các nhịp gần đây.`;
  }

  if (quality === "volatile") {
    return `Xu hướng có biến động cao với điểm chất lượng ${score}/100, nên đọc tín hiệu thận trọng hơn.`;
  }

  if (quality === "choppy") {
    return `Xu hướng còn nhiễu với điểm chất lượng ${score}/100, các tín hiệu cần thêm xác nhận.`;
  }

  return `Chất lượng xu hướng yếu với điểm ${score}/100, chưa cho thấy nhịp đi rõ ràng.`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
