import type {
  PatternConfidence,
  TechnicalIndicators,
  WyckoffLiteAnalysis,
  WyckoffPhaseGuess,
} from "@/lib/technical-analysis/types";
import type { OHLCV } from "@/types/stock";

export function analyzeWyckoffPhase(
  candles: OHLCV[],
  volume: number[],
  indicators: TechnicalIndicators,
): WyckoffLiteAnalysis {
  const recent = candles.slice(-30);
  const latest = candles[candles.length - 1];
  const closes = recent.map((candle) => candle.close);
  const rangePercent = getRangePercent(recent);
  const recentVolume = volume.slice(-20);
  const olderVolume = volume.slice(-40, -20);
  const volumeTrend = average(recentVolume) - average(olderVolume);
  const bouncedFromSupport = indicators.pullbackToMA20 || (indicators.breakLow20 === false && latest.close > latest.open);
  const evidence: string[] = [];
  const invalidationNotes: string[] = [];
  const scores: Record<WyckoffPhaseGuess, number> = {
    accumulation: 0,
    markup: 0,
    distribution: 0,
    markdown: 0,
    range: 0,
    unclear: 0,
  };

  if (rangePercent !== null && rangePercent <= 10) {
    scores.range += 2;
    evidence.push("Giá dao động trong biên tương đối hẹp, nghiêng về trạng thái đi ngang.");
  }

  if (rangePercent !== null && rangePercent <= 8 && volumeTrend < 0) {
    scores.accumulation += 2;
    evidence.push("Biên dao động thu hẹp kèm volume giảm, có dấu hiệu tích lũy nhưng chưa đủ xác nhận.");
  }

  if (bouncedFromSupport && rangePercent !== null && rangePercent <= 12) {
    scores.accumulation += 1;
    evidence.push("Giá có phản ứng từ vùng hỗ trợ/MA ngắn hạn.");
  }

  if (indicators.higherHighHigherLow) {
    scores.markup += 2;
    evidence.push("Cấu trúc đỉnh đáy nâng dần, nghiêng về pha tăng giá.");
  }

  if (indicators.ema20 !== null && indicators.ema50 !== null && latest.close > indicators.ema20 && indicators.ema20 > indicators.ema50) {
    scores.markup += 2;
    evidence.push("Giá nằm trên EMA20/EMA50, xu hướng ngắn hạn đang ủng hộ bên mua.");
  }

  if (indicators.breakoutVolumeConfirmation) {
    scores.markup += 2;
    evidence.push("Breakout có thanh khoản xác nhận.");
  }

  if (isNearRecentHigh(closes, latest.close) && volumeTrend > 0 && !indicators.breakHigh20) {
    scores.distribution += 2;
    evidence.push("Giá ở vùng cao nhưng chưa tiến xa dù volume tăng, có dấu hiệu phân phối nhẹ.");
  }

  if (hasUpperWickCluster(recent.slice(-5))) {
    scores.distribution += 1;
    evidence.push("Một số nến gần đây có bóng trên dài, hàm ý lực bán xuất hiện ở vùng cao.");
  }

  if (indicators.lowerHighLowerLow) {
    scores.markdown += 2;
    evidence.push("Cấu trúc đỉnh đáy hạ dần, nghiêng về pha suy yếu.");
  }

  if (indicators.brokenMA20 || indicators.brokenMA50 || indicators.breakLow20) {
    scores.markdown += indicators.brokenMA50 || indicators.breakLow20 ? 2 : 1;
    evidence.push("Giá đang mất các vùng hỗ trợ/MA quan trọng.");
  }

  if (indicators.breakoutVolumeConfirmation) {
    invalidationNotes.push("Nếu breakout thất bại và giá quay xuống dưới vùng hỗ trợ gần, kịch bản tăng cần được kiểm tra lại.");
  }

  if (indicators.lowerHighLowerLow || indicators.breakLow20) {
    invalidationNotes.push("Nếu giá lấy lại MA20/MA50 với thanh khoản cải thiện, kịch bản suy yếu có thể giảm độ tin cậy.");
  }

  if (invalidationNotes.length === 0) {
    invalidationNotes.push("Cần thêm xác nhận từ hướng phá vỡ biên giá và phản ứng volume trong các phiên tới.");
  }

  const phaseGuess = pickPhase(scores);
  const confidence = getConfidence(scores[phaseGuess], evidence.length);

  return {
    phaseGuess,
    confidence,
    evidence: evidence.slice(0, 4),
    invalidationNotes: invalidationNotes.slice(0, 3),
    summaryVi: createSummary(phaseGuess, confidence),
  };
}

function pickPhase(scores: Record<WyckoffPhaseGuess, number>): WyckoffPhaseGuess {
  const ranked = (Object.entries(scores) as Array<[WyckoffPhaseGuess, number]>).sort((a, b) => b[1] - a[1]);
  const [top, topScore] = ranked[0];
  const secondScore = ranked[1]?.[1] ?? 0;

  if (topScore <= 1 || topScore - secondScore <= 1) {
    return topScore > 0 && top !== "unclear" ? top : "unclear";
  }

  return top;
}

function getConfidence(score: number, evidenceCount: number): PatternConfidence {
  if (score >= 4 && evidenceCount >= 3) return "high";
  if (score >= 2) return "medium";
  return "low";
}

function createSummary(phase: WyckoffPhaseGuess, confidence: PatternConfidence): string {
  const confidenceText = getConfidenceLabel(confidence).toLowerCase();
  const phaseText = getWyckoffPhaseLabel(phase).toLowerCase();

  if (phase === "unclear") {
    return "Wyckoff-lite chưa có đủ xác nhận để nghiêng rõ về một pha cụ thể.";
  }

  return `Wyckoff-lite nghiêng về ${phaseText} với độ tin cậy ${confidenceText}; nên xem đây là góc nhìn tham khảo, không phải kết luận chắc chắn.`;
}

function getRangePercent(candles: OHLCV[]): number | null {
  if (candles.length === 0) return null;

  const high = Math.max(...candles.map((candle) => candle.high));
  const low = Math.min(...candles.map((candle) => candle.low));
  const latest = candles[candles.length - 1].close;

  return latest > 0 ? ((high - low) / latest) * 100 : null;
}

function isNearRecentHigh(closes: number[], latestClose: number): boolean {
  if (closes.length < 10) return false;
  const high = Math.max(...closes);
  return high > 0 && (high - latestClose) / high <= 0.04;
}

function hasUpperWickCluster(candles: OHLCV[]): boolean {
  return candles.filter((candle) => {
    const range = Math.max(candle.high - candle.low, 0.01);
    const upperShadow = candle.high - Math.max(candle.open, candle.close);
    return upperShadow / range >= 0.45;
  }).length >= 2;
}

function average(values: number[]): number {
  const validValues = values.filter(Number.isFinite);
  return validValues.length > 0 ? validValues.reduce((total, value) => total + value, 0) / validValues.length : 0;
}

export function getWyckoffPhaseLabel(phase: WyckoffPhaseGuess): string {
  const labels: Record<WyckoffPhaseGuess, string> = {
    accumulation: "Tích lũy",
    markup: "Markup",
    distribution: "Phân phối",
    markdown: "Markdown",
    range: "Đi ngang",
    unclear: "Chưa rõ",
  };

  return labels[phase];
}

export function getConfidenceLabel(confidence: PatternConfidence): string {
  if (confidence === "high") return "Cao";
  if (confidence === "medium") return "Trung bình";
  return "Thấp";
}
