import type {
  CandlestickPatternSignal,
  DojiType,
  PatternConfidence,
  SignalSentiment,
} from "@/lib/technical-analysis/types";
import type { OHLCV } from "@/types/stock";

type CandleShape = {
  candle: OHLCV;
  body: number;
  range: number;
  upperShadow: number;
  lowerShadow: number;
  isGreen: boolean;
  isRed: boolean;
};

export function analyzeCandlestickPatterns(candles: OHLCV[]): CandlestickPatternSignal[] {
  const recent = candles.slice(-5);
  const signals: CandlestickPatternSignal[] = [];

  for (let index = Math.max(0, recent.length - 3); index < recent.length; index += 1) {
    const current = recent[index];
    const previous = recent[index - 1];
    const beforePrevious = recent[index - 2];
    const shape = getShape(current);
    const previousShape = previous ? getShape(previous) : null;
    const beforePreviousShape = beforePrevious ? getShape(beforePrevious) : null;
    const sourceIndex = candles.length - recent.length + index;

    if (isDoji(shape)) {
      signals.push(createDojiPattern(shape, candles, sourceIndex));
    }

    if (isHammer(shape)) {
      signals.push(createPattern("hammer", "Hammer", "bullish", "medium", "Có dấu hiệu nến hammer: giá bị ép xuống nhưng hồi lại trong phiên, nghiêng về lực đỡ ngắn hạn.", current.date));
    }

    if (isShootingStar(shape)) {
      signals.push(createPattern("shooting-star", "Shooting Star", "bearish", "medium", "Có dấu hiệu shooting star: giá kéo lên nhưng bị bán xuống, cần thận trọng nếu xuất hiện gần kháng cự.", current.date));
    }

    if (previousShape && isBullishEngulfing(shape, previousShape)) {
      signals.push(createPattern("bullish-engulfing", "Bullish Engulfing", "bullish", "high", "Nến tăng bao phủ thân nến giảm trước đó, nghiêng về lực mua cải thiện nhưng vẫn cần xác nhận bằng volume.", current.date));
    }

    if (previousShape && isBearishEngulfing(shape, previousShape)) {
      signals.push(createPattern("bearish-engulfing", "Bearish Engulfing", "bearish", "high", "Nến giảm bao phủ thân nến tăng trước đó, cho thấy áp lực bán ngắn hạn đang rõ hơn.", current.date));
    }

    if (beforePreviousShape && previousShape && isMorningStar(shape, previousShape, beforePreviousShape)) {
      signals.push(createPattern("morning-star", "Morning Star", "bullish", "medium", "Cụm nến có dấu hiệu morning star, nghiêng về khả năng lực bán chậm lại và lực mua bắt đầu phản ứng.", current.date));
    }

    if (beforePreviousShape && previousShape && isEveningStar(shape, previousShape, beforePreviousShape)) {
      signals.push(createPattern("evening-star", "Evening Star", "bearish", "medium", "Cụm nến có dấu hiệu evening star, hàm ý đà tăng có thể đang chững lại.", current.date));
    }

    if (isMarubozu(shape)) {
      signals.push(createPattern("marubozu", "Marubozu", shape.isGreen ? "bullish" : "bearish", "medium", shape.isGreen ? "Nến thân dài ít bóng, nghiêng về lực mua chiếm ưu thế trong phiên." : "Nến thân dài ít bóng, nghiêng về áp lực bán chiếm ưu thế trong phiên.", current.date));
    }
  }

  return dedupePatterns(signals).slice(0, 5);
}

function getShape(candle: OHLCV): CandleShape {
  const range = Math.max(candle.high - candle.low, 0.01);
  const body = Math.abs(candle.close - candle.open);

  return {
    candle,
    body,
    range,
    upperShadow: candle.high - Math.max(candle.open, candle.close),
    lowerShadow: Math.min(candle.open, candle.close) - candle.low,
    isGreen: candle.close >= candle.open,
    isRed: candle.close < candle.open,
  };
}

function isDoji(shape: CandleShape): boolean {
  return shape.body / shape.range <= 0.1;
}

function createDojiPattern(shape: CandleShape, candles: OHLCV[], sourceIndex: number): CandlestickPatternSignal {
  const dojiType = getDojiType(shape);
  const previousTrend = getPreviousTrend(candles, sourceIndex);
  const volumeContext = getVolumeContext(candles, sourceIndex);
  const supportContext = getSupportContext(candles, sourceIndex, shape);
  const volatilityContext = getVolatilityContext(candles, sourceIndex, shape);
  const contextNotes = [previousTrend.note, volumeContext.note, supportContext.note, volatilityContext.note];
  const sentiment = getDojiSentiment(dojiType, previousTrend.direction, supportContext.zone);
  const confidence = getDojiConfidence(volumeContext.isImproving, supportContext.zone !== "middle", volatilityContext.isWide);
  const summaryVi = createDojiSummary(dojiType, supportContext.zone, volumeContext.isImproving, volatilityContext.isWide);

  return {
    pattern: "doji",
    labelVi: getDojiLabel(dojiType),
    dojiType,
    sentiment,
    confidence,
    descriptionVi: summaryVi,
    contextNotes,
    summaryVi,
    detectedAt: shape.candle.date,
  };
}

function getDojiType(shape: CandleShape): DojiType {
  const upperRatio = shape.upperShadow / shape.range;
  const lowerRatio = shape.lowerShadow / shape.range;

  if (lowerRatio >= 0.6 && upperRatio <= 0.18) return "dragonfly";
  if (upperRatio >= 0.6 && lowerRatio <= 0.18) return "gravestone";
  if (upperRatio >= 0.3 && lowerRatio >= 0.3) return "long-legged";
  return "standard";
}

function getPreviousTrend(candles: OHLCV[], sourceIndex: number): { direction: "up" | "down" | "flat"; note: string } {
  const lookback = candles.slice(Math.max(0, sourceIndex - 8), sourceIndex);

  if (lookback.length < 4) {
    return { direction: "flat", note: "Chưa đủ dữ liệu để đọc xu hướng trước nến doji." };
  }

  const changePercent = ((lookback[lookback.length - 1].close - lookback[0].close) / lookback[0].close) * 100;

  if (changePercent >= 3) return { direction: "up", note: "Xuất hiện sau một nhịp tăng ngắn hạn." };
  if (changePercent <= -3) return { direction: "down", note: "Xuất hiện sau một nhịp giảm ngắn hạn." };
  return { direction: "flat", note: "Xuất hiện trong vùng giá đi ngang." };
}

function getVolumeContext(candles: OHLCV[], sourceIndex: number): { isImproving: boolean; note: string } {
  const current = candles[sourceIndex];
  const previous = candles.slice(Math.max(0, sourceIndex - 20), sourceIndex);
  const averageVolume = previous.length > 0 ? previous.reduce((total, candle) => total + candle.volume, 0) / previous.length : null;

  if (averageVolume === null || averageVolume <= 0) {
    return { isImproving: false, note: "Chưa đủ dữ liệu volume để xác nhận." };
  }

  const ratio = current.volume / averageVolume;

  if (ratio >= 1.2) {
    return { isImproving: true, note: `Volume cao hơn trung bình 20 phiên khoảng ${ratio.toFixed(1)}x.` };
  }

  return { isImproving: false, note: "Volume chưa vượt rõ trung bình 20 phiên." };
}

function getSupportContext(
  candles: OHLCV[],
  sourceIndex: number,
  shape: CandleShape,
): { zone: "support" | "resistance" | "middle"; note: string } {
  const previous = candles.slice(Math.max(0, sourceIndex - 20), sourceIndex);

  if (previous.length < 10) {
    return { zone: "middle", note: "Chưa đủ dữ liệu để so với hỗ trợ/kháng cự gần." };
  }

  const low = Math.min(...previous.map((candle) => candle.low));
  const high = Math.max(...previous.map((candle) => candle.high));
  const close = shape.candle.close;
  const range = Math.max(high - low, 0.01);

  if ((close - low) / range <= 0.25) return { zone: "support", note: "Doji xuất hiện gần vùng hỗ trợ ngắn hạn." };
  if ((high - close) / range <= 0.25) return { zone: "resistance", note: "Doji xuất hiện gần vùng kháng cự ngắn hạn." };
  return { zone: "middle", note: "Doji nằm giữa biên dao động gần đây." };
}

function getVolatilityContext(
  candles: OHLCV[],
  sourceIndex: number,
  shape: CandleShape,
): { isWide: boolean; note: string } {
  const previous = candles.slice(Math.max(0, sourceIndex - 14), sourceIndex);
  const averageRange = previous.length > 0
    ? previous.reduce((total, candle) => total + Math.max(candle.high - candle.low, 0), 0) / previous.length
    : null;

  if (averageRange === null || averageRange <= 0) {
    return { isWide: false, note: "Chưa đủ dữ liệu biến động để so sánh." };
  }

  if (shape.range >= averageRange * 1.25) {
    return { isWide: true, note: "Biên nến rộng hơn bình thường, thể hiện trạng thái giằng co mạnh." };
  }

  return { isWide: false, note: "Biên nến chưa lớn hơn đáng kể so với gần đây." };
}

function getDojiSentiment(
  dojiType: DojiType,
  previousTrend: "up" | "down" | "flat",
  zone: "support" | "resistance" | "middle",
): SignalSentiment {
  if (dojiType === "dragonfly" && (zone === "support" || previousTrend === "down")) return "bullish";
  if (dojiType === "gravestone" && (zone === "resistance" || previousTrend === "up")) return "bearish";
  return "neutral";
}

function getDojiConfidence(hasVolume: boolean, hasZoneContext: boolean, hasWideRange: boolean): PatternConfidence {
  const score = Number(hasVolume) + Number(hasZoneContext) + Number(hasWideRange);
  if (score >= 2) return "high";
  if (score === 1) return "medium";
  return "low";
}

function getDojiLabel(dojiType: DojiType): string {
  if (dojiType === "dragonfly") return "Dragonfly Doji";
  if (dojiType === "gravestone") return "Gravestone Doji";
  if (dojiType === "long-legged") return "Long-legged Doji";
  return "Standard Doji";
}

function createDojiSummary(
  dojiType: DojiType,
  zone: "support" | "resistance" | "middle",
  hasVolume: boolean,
  hasWideRange: boolean,
): string {
  if (dojiType === "dragonfly") {
    return `Dragonfly Doji xuất hiện${zone === "support" ? " gần hỗ trợ" : ""}${hasVolume ? " với volume cải thiện" : ""}, nghiêng về phản ứng đỡ giá nhưng cần xác nhận thêm.`;
  }

  if (dojiType === "gravestone") {
    return `Gravestone Doji xuất hiện${zone === "resistance" ? " gần kháng cự" : ""}${hasVolume ? " với volume cao hơn bình thường" : ""}, cho thấy áp lực chốt lời cần được theo dõi.`;
  }

  if (dojiType === "long-legged") {
    return `Long-legged Doji cho thấy trạng thái giằng co mạnh${hasWideRange ? " với biên dao động rộng" : ""}.`;
  }

  return "Standard Doji cho thấy lực mua và bán đang khá cân bằng, tín hiệu cần thêm xác nhận.";
}

function isHammer(shape: CandleShape): boolean {
  return shape.lowerShadow >= shape.body * 2 && shape.upperShadow <= shape.body * 0.7 && shape.body / shape.range <= 0.35;
}

function isShootingStar(shape: CandleShape): boolean {
  return shape.upperShadow >= shape.body * 2 && shape.lowerShadow <= shape.body * 0.7 && shape.body / shape.range <= 0.35;
}

function isBullishEngulfing(current: CandleShape, previous: CandleShape): boolean {
  return previous.isRed && current.isGreen && current.candle.open <= previous.candle.close && current.candle.close >= previous.candle.open;
}

function isBearishEngulfing(current: CandleShape, previous: CandleShape): boolean {
  return previous.isGreen && current.isRed && current.candle.open >= previous.candle.close && current.candle.close <= previous.candle.open;
}

function isMorningStar(current: CandleShape, middle: CandleShape, first: CandleShape): boolean {
  return first.isRed && middle.body / middle.range <= 0.35 && current.isGreen && current.candle.close > midpoint(first);
}

function isEveningStar(current: CandleShape, middle: CandleShape, first: CandleShape): boolean {
  return first.isGreen && middle.body / middle.range <= 0.35 && current.isRed && current.candle.close < midpoint(first);
}

function isMarubozu(shape: CandleShape): boolean {
  return shape.body / shape.range >= 0.75 && shape.upperShadow / shape.range <= 0.12 && shape.lowerShadow / shape.range <= 0.12;
}

function midpoint(shape: CandleShape): number {
  return (shape.candle.open + shape.candle.close) / 2;
}

function createPattern(
  pattern: CandlestickPatternSignal["pattern"],
  labelVi: string,
  sentiment: SignalSentiment,
  confidence: PatternConfidence,
  descriptionVi: string,
  detectedAt: string,
): CandlestickPatternSignal {
  return {
    pattern,
    labelVi,
    sentiment,
    confidence,
    descriptionVi,
    detectedAt,
  };
}

function dedupePatterns(patterns: CandlestickPatternSignal[]): CandlestickPatternSignal[] {
  const seen = new Set<string>();

  return [...patterns].reverse().filter((pattern) => {
    const key = `${pattern.pattern}-${pattern.dojiType ?? ""}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
