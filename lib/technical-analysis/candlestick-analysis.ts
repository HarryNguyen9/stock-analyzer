import type {
  CandlestickPatternSignal,
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

    if (isDoji(shape)) {
      signals.push(createPattern("doji", "Doji", "neutral", "medium", "Nến doji cho thấy lực mua và bán đang khá cân bằng, tín hiệu cần thêm xác nhận.", current.date));
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
    const key = pattern.pattern;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
