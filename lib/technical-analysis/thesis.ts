import type {
  SignalSentiment,
  TechnicalAnalysisResult,
  TechnicalSetupType,
  TechnicalThesis,
} from "@/lib/technical-analysis/types";
import type { OHLCV } from "@/types/stock";

export function buildTechnicalThesis(
  analysis: Omit<TechnicalAnalysisResult, "thesis">,
  candles: OHLCV[],
): TechnicalThesis {
  const latest = candles[candles.length - 1];
  const indicators = analysis.indicators;
  const supportResistance = analysis.supportResistance;
  const trendBias = getTrendBias(latest.close, analysis);
  const setupType = getSetupType(latest.close, analysis, trendBias);
  const keySupport = supportResistance.nearestSupport ?? supportResistance.low20 ?? null;
  const keyResistance = supportResistance.nearestResistance ?? supportResistance.high20 ?? null;
  const invalidationLevel = getInvalidationLevel(setupType, keySupport, supportResistance.low20);
  const conditionsToImprove = getConditionsToImprove(setupType, analysis);
  const keyRisks = getKeyRisks(analysis);

  return {
    setupType,
    trendBias,
    keySupport,
    keyResistance,
    invalidationLevel,
    conditionsToImprove,
    keyRisks,
    shortSummaryVi: createShortSummary({
      setupType,
      trendBias,
      keySupport,
      keyResistance,
      invalidationLevel,
      latestClose: latest.close,
      volumeSpikeRatio: indicators.volumeSpikeRatio,
    }),
  };
}

function getTrendBias(
  latestClose: number,
  analysis: Omit<TechnicalAnalysisResult, "thesis">,
): SignalSentiment {
  const indicators = analysis.indicators;

  if (
    indicators.ema20 !== null &&
    indicators.ema50 !== null &&
    latestClose > indicators.ema20 &&
    indicators.ema20 >= indicators.ema50 &&
    !indicators.macdBearish
  ) {
    return "bullish";
  }

  if (
    indicators.ema20 !== null &&
    indicators.ema50 !== null &&
    latestClose < indicators.ema20 &&
    indicators.ema20 <= indicators.ema50
  ) {
    return "bearish";
  }

  return "neutral";
}

function getSetupType(
  latestClose: number,
  analysis: Omit<TechnicalAnalysisResult, "thesis">,
  trendBias: SignalSentiment,
): TechnicalSetupType {
  const indicators = analysis.indicators;

  if (indicators.heavySellingVolume || indicators.brokenMA50 || (indicators.rsiOverbought && indicators.macdBearish)) {
    return "high-risk";
  }

  if (trendBias === "bearish" || indicators.lowerHighLowerLow) {
    return "downtrend";
  }

  if (indicators.breakHigh20 || indicators.breakoutVolumeConfirmation) {
    return "breakout";
  }

  if (indicators.pullbackToMA20 || indicators.retestBreakoutZone) {
    return "pullback";
  }

  if (indicators.consolidationRange && indicators.bollingerBands20.squeeze) {
    return "accumulation";
  }

  if (
    indicators.consolidationRange ||
    (analysis.supportResistance.nearestSupport !== null && analysis.supportResistance.nearestResistance !== null)
  ) {
    return "range-bound";
  }

  return latestClose >= (indicators.ema20 ?? latestClose) ? "pullback" : "range-bound";
}

function getInvalidationLevel(
  setupType: TechnicalSetupType,
  keySupport: number | null,
  low20: number | null,
): number | null {
  if (setupType === "breakout" || setupType === "pullback" || setupType === "accumulation") {
    return keySupport ?? low20;
  }

  if (setupType === "range-bound") {
    return low20 ?? keySupport;
  }

  return keySupport ?? low20;
}

function getConditionsToImprove(analysis: Omit<TechnicalAnalysisResult, "thesis">): string[] {
  const indicators = analysis.indicators;
  const conditions: string[] = [];

  if (!indicators.breakoutVolumeConfirmation) {
    conditions.push("Giá cần vượt vùng cản gần với thanh khoản cao hơn trung bình 20 phiên.");
  }

  if (indicators.macd.histogram === null || indicators.macd.histogram <= 0) {
    conditions.push("MACD histogram cải thiện lên vùng dương để xác nhận động lượng.");
  }

  if (indicators.ema20 !== null && indicators.ema50 !== null && indicators.ema20 < indicators.ema50) {
    conditions.push("EMA20 cần lấy lại vị thế trên EMA50 để xu hướng ngắn hạn khỏe hơn.");
  }

  if (conditions.length === 0) {
    conditions.push("Duy trì giá trên vùng hỗ trợ gần và giữ volume ổn định trong các phiên tới.");
  }

  return conditions.slice(0, 3);
}

function getKeyRisks(analysis: Omit<TechnicalAnalysisResult, "thesis">): string[] {
  const indicators = analysis.indicators;
  const risks: string[] = [];

  if (indicators.brokenMA50) {
    risks.push("Giá đã gãy MA50, cấu trúc trung hạn cần được theo dõi thận trọng.");
  }

  if (indicators.heavySellingVolume) {
    risks.push("Có dấu hiệu bán mạnh kèm thanh khoản cao.");
  }

  if (indicators.rsiOverbought) {
    risks.push("RSI ở vùng cao, biên an toàn ngắn hạn giảm.");
  }

  if (indicators.macdBearish) {
    risks.push("MACD đang nghiêng về phía suy yếu động lượng.");
  }

  if (analysis.supportResistance.distanceToResistancePercent !== null && analysis.supportResistance.distanceToResistancePercent <= 3) {
    risks.push("Giá đang gần kháng cự, dễ xuất hiện rung lắc nếu lực mua không đủ mạnh.");
  }

  if (risks.length === 0) {
    risks.push("Rủi ro nổi bật chưa rõ, nhưng vẫn cần quan sát phản ứng tại hỗ trợ/kháng cự gần.");
  }

  return risks.slice(0, 3);
}

function createShortSummary(input: {
  setupType: TechnicalSetupType;
  trendBias: SignalSentiment;
  keySupport: number | null;
  keyResistance: number | null;
  invalidationLevel: number | null;
  latestClose: number;
  volumeSpikeRatio: number | null;
}): string {
  const setup = getSetupLabel(input.setupType).toLowerCase();
  const bias = getTrendBiasLabel(input.trendBias).toLowerCase();
  const support = input.keySupport !== null ? `hỗ trợ gần ${input.keySupport.toFixed(2)}` : "hỗ trợ gần chưa rõ";
  const resistance =
    input.keyResistance !== null ? `kháng cự gần ${input.keyResistance.toFixed(2)}` : "kháng cự gần chưa rõ";
  const invalidation =
    input.invalidationLevel !== null ? `Mốc cần theo dõi nếu suy yếu là ${input.invalidationLevel.toFixed(2)}.` : "";
  const volume =
    input.volumeSpikeRatio !== null && input.volumeSpikeRatio >= 1.2
      ? `Thanh khoản đang cao hơn nền 20 phiên (${input.volumeSpikeRatio.toFixed(2)}x).`
      : "Thanh khoản chưa quá nổi bật so với nền 20 phiên.";

  return `Setup hiện tại thiên về ${setup}, xu hướng ${bias}. Giá đóng cửa ${input.latestClose.toFixed(2)}, ${support}, ${resistance}. ${volume} ${invalidation}`.trim();
}

export function getSetupLabel(setupType: TechnicalSetupType): string {
  const labels: Record<TechnicalSetupType, string> = {
    breakout: "Breakout",
    pullback: "Pullback",
    accumulation: "Tích lũy",
    downtrend: "Xu hướng giảm",
    "range-bound": "Đi ngang",
    "high-risk": "Rủi ro cao",
  };

  return labels[setupType];
}

export function getTrendBiasLabel(trendBias: SignalSentiment): string {
  if (trendBias === "bullish") return "Tích cực";
  if (trendBias === "bearish") return "Tiêu cực";
  return "Trung tính";
}
