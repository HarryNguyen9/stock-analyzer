import type {
  CandlestickPatterns,
  MethodSummary,
  SupportResistance,
  TechnicalIndicators,
} from "@/lib/technical-analysis/types";
import type { OHLCV } from "@/types/stock";

export function createMethodSummaries(input: {
  latest: OHLCV;
  indicators: TechnicalIndicators;
  patterns: CandlestickPatterns;
  supportResistance: SupportResistance;
}): MethodSummary[] {
  const { latest, indicators, patterns, supportResistance } = input;
  const trendTone = getTrendTone(latest.close, indicators);
  const momentumTone = getMomentumTone(indicators);
  const volumeTone = indicators.priceUpWithVolumeUp || indicators.breakoutVolumeConfirmation ? "bullish" : "neutral";
  const volatilityTone = indicators.breakHigh20 ? "bullish" : indicators.breakLow20 ? "bearish" : "neutral";
  const supportTone =
    supportResistance.distanceToResistancePercent !== null && supportResistance.distanceToResistancePercent <= 3
      ? "neutral"
      : supportResistance.distanceToSupportPercent !== null && supportResistance.distanceToSupportPercent <= 3
        ? "bearish"
        : "neutral";
  const patternTone = patterns.bullishEngulfing || patterns.hammer
    ? "bullish"
    : patterns.bearishEngulfing || patterns.shootingStar
      ? "bearish"
      : "neutral";

  return [
    {
      key: "trend",
      titleVi: "Xu hướng",
      tone: trendTone,
      conclusionVi: createTrendConclusion(latest.close, indicators),
      items: [
        { label: "EMA20", value: formatNumber(indicators.ema20) },
        { label: "EMA50", value: formatNumber(indicators.ema50) },
        { label: "EMA200", value: formatNumber(indicators.ema200) },
        { label: "ADX14", value: formatNumber(indicators.adx14) },
      ],
    },
    {
      key: "momentum",
      titleVi: "Động lượng",
      tone: momentumTone,
      conclusionVi: createMomentumConclusion(indicators),
      items: [
        { label: "RSI14", value: formatNumber(indicators.rsi14) },
        { label: "MACD hist", value: formatNumber(indicators.macd.histogram) },
        { label: "ROC10", value: formatPercent(indicators.roc10) },
        { label: "Stoch RSI", value: formatNumber(indicators.stochasticRsi) },
      ],
    },
    {
      key: "volume",
      titleVi: "Thanh khoản",
      tone: volumeTone,
      conclusionVi: createVolumeConclusion(indicators),
      items: [
        { label: "Volume/TB20", value: indicators.volumeSpikeRatio ? `${indicators.volumeSpikeRatio.toFixed(2)}x` : "N/A" },
        { label: "OBV", value: formatCompact(indicators.obv) },
      ],
    },
    {
      key: "volatility",
      titleVi: "Biến động",
      tone: volatilityTone,
      conclusionVi: createVolatilityConclusion(indicators),
      items: [
        { label: "BB upper", value: formatNumber(indicators.bollingerBands20.upper) },
        { label: "BB lower", value: formatNumber(indicators.bollingerBands20.lower) },
        { label: "BB width", value: formatPercent(indicators.bollingerBands20.width) },
        { label: "ATR14", value: formatNumber(indicators.atr14) },
      ],
    },
    {
      key: "supportResistance",
      titleVi: "Hỗ trợ / Kháng cự",
      tone: supportTone,
      conclusionVi: createSupportResistanceConclusion(supportResistance),
      items: [
        { label: "Hỗ trợ gần", value: formatNumber(supportResistance.nearestSupport) },
        { label: "Kháng cự gần", value: formatNumber(supportResistance.nearestResistance) },
        { label: "Đỉnh 20/50", value: `${formatNumber(supportResistance.high20)} / ${formatNumber(supportResistance.high50)}` },
        { label: "Đáy 20/50", value: `${formatNumber(supportResistance.low20)} / ${formatNumber(supportResistance.low50)}` },
      ],
    },
    {
      key: "patterns",
      titleVi: "Mẫu nến",
      tone: patternTone,
      conclusionVi: createPatternConclusion(patterns),
      items: getPatternItems(patterns),
    },
  ];
}

function createTrendConclusion(latestClose: number, indicators: TechnicalIndicators): string {
  if (indicators.ema20 && indicators.ema50 && latestClose > indicators.ema20 && indicators.ema20 > indicators.ema50) {
    return "Giá giữ trên EMA20 và EMA20 cao hơn EMA50, xu hướng ngắn hạn đang tích cực.";
  }

  if (indicators.ema20 && latestClose < indicators.ema20) {
    return "Giá nằm dưới EMA20, xu hướng ngắn hạn đang yếu hoặc cần thêm xác nhận.";
  }

  return "Xu hướng chưa nghiêng rõ ràng, giá đang ở vùng cân bằng tương đối.";
}

function createMomentumConclusion(indicators: TechnicalIndicators): string {
  if (indicators.macd.histogram !== null && indicators.macd.histogram > 0 && indicators.rsi14 !== null && indicators.rsi14 >= 45) {
    return "MACD và RSI đang ủng hộ động lượng cải thiện.";
  }

  if (indicators.rsi14 !== null && indicators.rsi14 > 70) {
    return "RSI ở vùng cao, đà tăng có thể nóng và dễ rung lắc.";
  }

  if (indicators.macd.histogram !== null && indicators.macd.histogram < 0) {
    return "MACD histogram âm, động lượng ngắn hạn còn yếu.";
  }

  return "Động lượng ở vùng trung tính, nên chờ thêm tín hiệu giá và volume.";
}

function createVolumeConclusion(indicators: TechnicalIndicators): string {
  if (indicators.breakoutVolumeConfirmation) {
    return "Thanh khoản đang xác nhận breakout, đây là tín hiệu đáng chú ý.";
  }

  if (indicators.priceUpWithVolumeUp) {
    return "Giá tăng kèm volume tăng, dòng tiền đang tham gia tốt hơn.";
  }

  return "Thanh khoản chưa nổi bật so với nền 20 phiên.";
}

function createVolatilityConclusion(indicators: TechnicalIndicators): string {
  if (indicators.breakHigh20) return "Giá đang vượt vùng đỉnh 20 phiên.";
  if (indicators.breakLow20) return "Giá đang thủng vùng đáy 20 phiên, rủi ro cao hơn.";
  if (indicators.bollingerBands20.squeeze) return "Bollinger Bands co hẹp, có thể chuẩn bị cho nhịp biến động mới.";
  return "Biến động ở trạng thái bình thường, chưa có breakout rõ.";
}

function createSupportResistanceConclusion(supportResistance: SupportResistance): string {
  const support = supportResistance.distanceToSupportPercent;
  const resistance = supportResistance.distanceToResistancePercent;

  if (resistance !== null && resistance <= 3) {
    return `Giá đang gần kháng cự, còn khoảng ${resistance.toFixed(2)}% tới vùng cản gần nhất.`;
  }

  if (support !== null && support <= 3) {
    return `Giá đang sát hỗ trợ, còn khoảng ${support.toFixed(2)}% so với vùng đỡ gần nhất.`;
  }

  return "Giá đang ở giữa vùng hỗ trợ và kháng cự gần, biên dao động còn tương đối cân bằng.";
}

function createPatternConclusion(patterns: CandlestickPatterns): string {
  if (patterns.bullishEngulfing) return "Xuất hiện bullish engulfing, lực mua phiên mới đang lấn át phiên trước.";
  if (patterns.bearishEngulfing) return "Xuất hiện bearish engulfing, áp lực bán ngắn hạn cần được chú ý.";
  if (patterns.hammer) return "Có mẫu nến hammer, cho thấy lực đỡ xuất hiện trong phiên.";
  if (patterns.shootingStar) return "Có mẫu shooting star, giá bị bán xuống sau khi kéo lên.";
  if (patterns.doji) return "Nến doji cho thấy trạng thái lưỡng lự giữa bên mua và bên bán.";
  return "Chưa có mẫu nến đảo chiều nổi bật trong phiên mới nhất.";
}

function getTrendTone(latestClose: number, indicators: TechnicalIndicators): MethodSummary["tone"] {
  if (indicators.ema20 && indicators.ema50 && latestClose > indicators.ema20 && indicators.ema20 > indicators.ema50) return "bullish";
  if (indicators.ema20 && latestClose < indicators.ema20) return "bearish";
  return "neutral";
}

function getMomentumTone(indicators: TechnicalIndicators): MethodSummary["tone"] {
  if (indicators.macd.histogram !== null && indicators.macd.histogram > 0 && indicators.rsi14 !== null && indicators.rsi14 >= 45) return "bullish";
  if (indicators.macd.histogram !== null && indicators.macd.histogram < 0) return "bearish";
  return "neutral";
}

function getPatternItems(patterns: CandlestickPatterns): MethodSummary["items"] {
  return [
    { label: "Doji", value: patterns.doji ? "Có" : "Không" },
    { label: "Hammer", value: patterns.hammer ? "Có" : "Không" },
    { label: "Bullish engulfing", value: patterns.bullishEngulfing ? "Có" : "Không" },
    { label: "Bearish engulfing", value: patterns.bearishEngulfing ? "Có" : "Không" },
    { label: "Shooting star", value: patterns.shootingStar ? "Có" : "Không" },
  ];
}

function formatNumber(value: number | null): string {
  return value === null ? "N/A" : value.toFixed(2);
}

function formatPercent(value: number | null): string {
  return value === null ? "N/A" : `${value.toFixed(2)}%`;
}

function formatCompact(value: number | null): string {
  if (value === null) return "N/A";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}
