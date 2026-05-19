import type {
  CandlestickPatternSignal,
  CandlestickPatternType,
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

type PatternDraft = CandlestickPatternSignal & {
  rank: number;
};

type PatternContext = {
  previousTrend: "up" | "down" | "flat";
  zone: "support" | "resistance" | "middle";
  volumeRatio: number | null;
  isHighVolume: boolean;
  isWideRange: boolean;
  rangePosition: "near-low" | "near-high" | "middle";
  notes: string[];
};

export function analyzeCandlestickPatterns(candles: OHLCV[]): CandlestickPatternSignal[] {
  const recent = candles.slice(-10);
  const drafts: PatternDraft[] = [];

  for (let index = Math.max(0, recent.length - 5); index < recent.length; index += 1) {
    const current = recent[index];
    const previous = recent[index - 1];
    const beforePrevious = recent[index - 2];
    const shape = getShape(current);
    const previousShape = previous ? getShape(previous) : null;
    const beforePreviousShape = beforePrevious ? getShape(beforePrevious) : null;
    const sourceIndex = candles.length - recent.length + index;
    const context = getPatternContext(candles, sourceIndex, shape);

    if (isDoji(shape)) drafts.push(createDojiPattern(shape, context));
    if (isSpinningTop(shape)) drafts.push(createPattern("spinning-top", "Spinning Top", "indecision", "neutral", "low", "Nến thân nhỏ cho thấy lực mua và bán còn giằng co.", current.date, context, 35));
    if (isHighWave(shape)) drafts.push(createPattern("high-wave", "High Wave Candle", "indecision", "neutral", "medium", "Biên nến rộng với bóng hai đầu dài, cho thấy trạng thái do dự mạnh.", current.date, context, 52));

    if (isHammer(shape) && context.previousTrend === "down") drafts.push(createPattern("hammer", "Hammer", "reversal", "bullish", context.zone === "support" ? "high" : "medium", "Hammer xuất hiện sau nhịp giảm, cho thấy lực đỡ bắt đầu phản ứng.", current.date, context, 72));
    if (isInvertedHammer(shape) && context.previousTrend === "down") drafts.push(createPattern("inverted-hammer", "Inverted Hammer", "reversal", "bullish", context.isHighVolume ? "medium" : "low", "Inverted Hammer sau nhịp giảm cho thấy lực mua thử kéo giá lên nhưng cần xác nhận thêm.", current.date, context, 58));
    if (isHangingMan(shape) && context.previousTrend === "up") drafts.push(createPattern("hanging-man", "Hanging Man", "reversal", "bearish", context.zone === "resistance" ? "high" : "medium", "Hanging Man sau nhịp tăng cho thấy áp lực bán bắt đầu xuất hiện.", current.date, context, 70));
    if (isShootingStar(shape) && context.previousTrend === "up") drafts.push(createPattern("shooting-star", "Shooting Star", "reversal", "bearish", context.zone === "resistance" ? "high" : "medium", "Shooting Star gần vùng cao cho thấy lực bán phủ lên nhịp kéo giá.", current.date, context, 72));

    if (previousShape && isBullishEngulfing(shape, previousShape)) drafts.push(createPattern("bullish-engulfing", "Bullish Engulfing", "reversal", "bullish", context.isHighVolume ? "high" : "medium", "Nến tăng bao phủ thân nến giảm trước đó, nghiêng về lực mua cải thiện.", current.date, context, 78));
    if (previousShape && isBearishEngulfing(shape, previousShape)) drafts.push(createPattern("bearish-engulfing", "Bearish Engulfing", "reversal", "bearish", context.isHighVolume ? "high" : "medium", "Nến giảm bao phủ thân nến tăng trước đó, cho thấy áp lực bán rõ hơn.", current.date, context, 78));
    if (previousShape && isPiercingLine(shape, previousShape)) drafts.push(createPattern("piercing-line", "Piercing Line", "reversal", "bullish", "medium", "Piercing Line cho thấy lực mua kéo giá hồi lại đáng kể sau nến giảm.", current.date, context, 64));
    if (previousShape && isDarkCloudCover(shape, previousShape)) drafts.push(createPattern("dark-cloud-cover", "Dark Cloud Cover", "reversal", "bearish", "medium", "Dark Cloud Cover cho thấy áp lực bán chen vào sau nến tăng.", current.date, context, 64));

    if (beforePreviousShape && previousShape && isMorningStar(shape, previousShape, beforePreviousShape)) drafts.push(createPattern("morning-star", "Morning Star", "reversal", "bullish", "medium", "Cụm Morning Star nghiêng về khả năng lực bán chậm lại.", current.date, context, 68));
    if (beforePreviousShape && previousShape && isEveningStar(shape, previousShape, beforePreviousShape)) drafts.push(createPattern("evening-star", "Evening Star", "reversal", "bearish", "medium", "Cụm Evening Star hàm ý đà tăng có thể đang chững lại.", current.date, context, 68));

    if (previousShape && isInsideBar(shape, previousShape)) drafts.push(createPattern("inside-bar", "Inside Bar", "continuation", "neutral", "low", "Inside Bar cho thấy giá co hẹp, thường cần phá biên để xác nhận hướng tiếp theo.", current.date, context, 38));
    if (previousShape && isOutsideBar(shape, previousShape)) drafts.push(createPattern("outside-bar", "Outside Bar", "continuation", shape.isGreen ? "bullish" : "bearish", context.isHighVolume ? "high" : "medium", "Outside Bar cho thấy phiên mở rộng biên, cần theo dõi hướng đóng cửa.", current.date, context, 62));
    if (beforePreviousShape && previousShape && isThreeWhiteSoldiers(shape, previousShape, beforePreviousShape)) drafts.push(createPattern("three-white-soldiers", "Three White Soldiers", "continuation", "bullish", "high", "Ba nến tăng liên tiếp cho thấy động lượng mua đang cải thiện.", current.date, context, 80));
    if (beforePreviousShape && previousShape && isThreeBlackCrows(shape, previousShape, beforePreviousShape)) drafts.push(createPattern("three-black-crows", "Three Black Crows", "continuation", "bearish", "high", "Ba nến giảm liên tiếp cho thấy áp lực bán đang chiếm ưu thế.", current.date, context, 80));

    if (isMarubozu(shape)) drafts.push(createPattern("marubozu", "Marubozu", "continuation", shape.isGreen ? "bullish" : "bearish", context.isHighVolume ? "high" : "medium", shape.isGreen ? "Marubozu tăng cho thấy lực mua chiếm ưu thế trong phiên." : "Marubozu giảm cho thấy áp lực bán chiếm ưu thế trong phiên.", current.date, context, 66));
    if (previous && isGapUpWithVolume(current, previous, context)) drafts.push(createPattern("gap-up-volume", "Gap Up kèm volume", "continuation", "bullish", "high", "Gap Up đi kèm volume cao, có thể là tín hiệu breakaway cần theo dõi.", current.date, context, 76));
    if (previous && isGapDownWithVolume(current, previous, context)) drafts.push(createPattern("gap-down-volume", "Gap Down kèm volume", "continuation", "bearish", "high", "Gap Down đi kèm volume cao, phản ánh áp lực bán mạnh hơn bình thường.", current.date, context, 76));

    if (isSupportRejection(shape, context)) drafts.push(createPattern("support-rejection", "Nến phản ứng tại hỗ trợ", "reversal", "bullish", context.isHighVolume ? "high" : "medium", "Giá rút chân gần hỗ trợ, cho thấy lực đỡ ngắn hạn xuất hiện.", current.date, context, 70));
    if (isResistanceRejection(shape, context)) drafts.push(createPattern("resistance-rejection", "Nến bị bán tại kháng cự", "reversal", "bearish", context.isHighVolume ? "high" : "medium", "Giá rút đầu gần kháng cự, cho thấy áp lực bán cần theo dõi.", current.date, context, 70));
    if (isLargeVolumeCandle(context)) drafts.push(createPattern("large-volume-candle", "Nến volume lớn", "continuation", shape.isGreen ? "bullish" : "bearish", "medium", "Volume tăng mạnh so với trung bình, phản ánh dòng tiền tham gia rõ hơn.", current.date, context, 55));
    if (isRejectionCandle(shape)) drafts.push(createPattern("rejection-candle", "Rejection Candle", "reversal", getRejectionSentiment(shape), "medium", "Nến có bóng dài cho thấy giá bị từ chối ở một phía của biên dao động.", current.date, context, 54));
  }

  return dedupePatterns(drafts)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 3)
    .map(({ rank: _rank, ...pattern }) => pattern);
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

function getPatternContext(candles: OHLCV[], sourceIndex: number, shape: CandleShape): PatternContext {
  const previousTrend = getPreviousTrend(candles, sourceIndex).direction;
  const volumeContext = getVolumeContext(candles, sourceIndex);
  const supportContext = getSupportContext(candles, sourceIndex, shape);
  const volatilityContext = getVolatilityContext(candles, sourceIndex, shape);
  const rangePosition = getRangePosition(candles, sourceIndex, shape.candle.close);
  const notes = [
    getPreviousTrend(candles, sourceIndex).note,
    supportContext.note,
    volumeContext.note,
    volatilityContext.note,
    rangePosition === "near-low" ? "Giá đang ở nửa dưới biên dao động gần đây." : rangePosition === "near-high" ? "Giá đang ở nửa trên biên dao động gần đây." : "Giá nằm giữa biên dao động gần đây.",
  ];

  return {
    previousTrend,
    zone: supportContext.zone,
    volumeRatio: volumeContext.ratio,
    isHighVolume: volumeContext.isImproving,
    isWideRange: volatilityContext.isWide,
    rangePosition,
    notes,
  };
}

function isDoji(shape: CandleShape): boolean {
  return shape.body / shape.range <= 0.1;
}

function isSpinningTop(shape: CandleShape): boolean {
  return shape.body / shape.range > 0.1 && shape.body / shape.range <= 0.28 && shape.upperShadow > shape.body * 0.6 && shape.lowerShadow > shape.body * 0.6;
}

function isHighWave(shape: CandleShape): boolean {
  return shape.body / shape.range <= 0.25 && shape.upperShadow / shape.range >= 0.3 && shape.lowerShadow / shape.range >= 0.3;
}

function createDojiPattern(shape: CandleShape, context: PatternContext): PatternDraft {
  const dojiType = getDojiType(shape);
  const sentiment = getDojiSentiment(dojiType, context.previousTrend, context.zone);
  const confidence = getContextConfidence(context, sentiment === "neutral" ? 0 : 1);
  const summaryVi = createDojiSummary(dojiType, context.zone, context.isHighVolume, context.isWideRange);

  return {
    ...createPattern("doji", getDojiLabel(dojiType), "indecision", sentiment, confidence, summaryVi, shape.candle.date, context, 50),
    dojiType,
    summaryVi,
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

function isHammer(shape: CandleShape): boolean {
  return shape.lowerShadow >= shape.body * 2 && shape.upperShadow <= shape.body * 0.7 && shape.body / shape.range <= 0.35;
}

function isInvertedHammer(shape: CandleShape): boolean {
  return shape.upperShadow >= shape.body * 2 && shape.lowerShadow <= shape.body * 0.7 && shape.body / shape.range <= 0.35 && shape.isGreen;
}

function isHangingMan(shape: CandleShape): boolean {
  return isHammer(shape);
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

function isPiercingLine(current: CandleShape, previous: CandleShape): boolean {
  return previous.isRed && current.isGreen && current.candle.open < previous.candle.close && current.candle.close > midpoint(previous) && current.candle.close < previous.candle.open;
}

function isDarkCloudCover(current: CandleShape, previous: CandleShape): boolean {
  return previous.isGreen && current.isRed && current.candle.open > previous.candle.close && current.candle.close < midpoint(previous) && current.candle.close > previous.candle.open;
}

function isMorningStar(current: CandleShape, middle: CandleShape, first: CandleShape): boolean {
  return first.isRed && middle.body / middle.range <= 0.35 && current.isGreen && current.candle.close > midpoint(first);
}

function isEveningStar(current: CandleShape, middle: CandleShape, first: CandleShape): boolean {
  return first.isGreen && middle.body / middle.range <= 0.35 && current.isRed && current.candle.close < midpoint(first);
}

function isInsideBar(current: CandleShape, previous: CandleShape): boolean {
  return current.candle.high <= previous.candle.high && current.candle.low >= previous.candle.low;
}

function isOutsideBar(current: CandleShape, previous: CandleShape): boolean {
  return current.candle.high >= previous.candle.high && current.candle.low <= previous.candle.low;
}

function isThreeWhiteSoldiers(current: CandleShape, previous: CandleShape, first: CandleShape): boolean {
  return first.isGreen && previous.isGreen && current.isGreen && previous.candle.close > first.candle.close && current.candle.close > previous.candle.close;
}

function isThreeBlackCrows(current: CandleShape, previous: CandleShape, first: CandleShape): boolean {
  return first.isRed && previous.isRed && current.isRed && previous.candle.close < first.candle.close && current.candle.close < previous.candle.close;
}

function isMarubozu(shape: CandleShape): boolean {
  return shape.body / shape.range >= 0.75 && shape.upperShadow / shape.range <= 0.12 && shape.lowerShadow / shape.range <= 0.12;
}

function isGapUpWithVolume(current: OHLCV, previous: OHLCV, context: PatternContext): boolean {
  return current.low > previous.high && context.isHighVolume;
}

function isGapDownWithVolume(current: OHLCV, previous: OHLCV, context: PatternContext): boolean {
  return current.high < previous.low && context.isHighVolume;
}

function isSupportRejection(shape: CandleShape, context: PatternContext): boolean {
  return context.zone === "support" && shape.lowerShadow / shape.range >= 0.45;
}

function isResistanceRejection(shape: CandleShape, context: PatternContext): boolean {
  return context.zone === "resistance" && shape.upperShadow / shape.range >= 0.45;
}

function isLargeVolumeCandle(context: PatternContext): boolean {
  return context.volumeRatio !== null && context.volumeRatio >= 1.8;
}

function isRejectionCandle(shape: CandleShape): boolean {
  return shape.upperShadow / shape.range >= 0.5 || shape.lowerShadow / shape.range >= 0.5;
}

function getRejectionSentiment(shape: CandleShape): SignalSentiment {
  if (shape.lowerShadow > shape.upperShadow) return "bullish";
  if (shape.upperShadow > shape.lowerShadow) return "bearish";
  return "neutral";
}

function midpoint(shape: CandleShape): number {
  return (shape.candle.open + shape.candle.close) / 2;
}

function createPattern(
  pattern: CandlestickPatternSignal["pattern"],
  labelVi: string,
  type: CandlestickPatternType,
  sentiment: SignalSentiment,
  confidence: PatternConfidence,
  descriptionVi: string,
  detectedAt: string,
  context: PatternContext,
  baseRank: number,
): PatternDraft {
  return {
    pattern,
    name: labelVi,
    type,
    labelVi,
    sentiment,
    confidence,
    descriptionVi,
    contextNotes: context.notes,
    summaryVi: descriptionVi,
    detectedAt,
    rank: baseRank + getContextRankBonus(context, confidence),
  };
}

function getContextRankBonus(context: PatternContext, confidence: PatternConfidence): number {
  return (confidence === "high" ? 14 : confidence === "medium" ? 7 : 0) + (context.isHighVolume ? 8 : 0) + (context.zone !== "middle" ? 6 : 0) + (context.isWideRange ? 4 : 0);
}

function getContextConfidence(context: PatternContext, baseScore: number): PatternConfidence {
  const score = baseScore + Number(context.isHighVolume) + Number(context.zone !== "middle") + Number(context.isWideRange);
  if (score >= 3) return "high";
  if (score >= 1) return "medium";
  return "low";
}

function getPreviousTrend(candles: OHLCV[], sourceIndex: number): { direction: "up" | "down" | "flat"; note: string } {
  const lookback = candles.slice(Math.max(0, sourceIndex - 8), sourceIndex);

  if (lookback.length < 4) {
    return { direction: "flat", note: "Chưa đủ dữ liệu để đọc xu hướng trước mẫu nến." };
  }

  const changePercent = ((lookback[lookback.length - 1].close - lookback[0].close) / lookback[0].close) * 100;

  if (changePercent >= 3) return { direction: "up", note: "Xuất hiện sau một nhịp tăng ngắn hạn." };
  if (changePercent <= -3) return { direction: "down", note: "Xuất hiện sau một nhịp giảm ngắn hạn." };
  return { direction: "flat", note: "Xuất hiện trong vùng giá đi ngang." };
}

function getVolumeContext(candles: OHLCV[], sourceIndex: number): { isImproving: boolean; ratio: number | null; note: string } {
  const current = candles[sourceIndex];
  const previous = candles.slice(Math.max(0, sourceIndex - 20), sourceIndex);
  const averageVolume = previous.length > 0 ? previous.reduce((total, candle) => total + candle.volume, 0) / previous.length : null;

  if (averageVolume === null || averageVolume <= 0) {
    return { isImproving: false, ratio: null, note: "Chưa đủ dữ liệu volume để xác nhận." };
  }

  const ratio = current.volume / averageVolume;

  if (ratio >= 1.2) {
    return { isImproving: true, ratio, note: `Volume cao hơn trung bình 20 phiên khoảng ${ratio.toFixed(1)}x.` };
  }

  return { isImproving: false, ratio, note: "Volume chưa vượt rõ trung bình 20 phiên." };
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

  if ((close - low) / range <= 0.25) return { zone: "support", note: "Mẫu nến xuất hiện gần vùng hỗ trợ ngắn hạn." };
  if ((high - close) / range <= 0.25) return { zone: "resistance", note: "Mẫu nến xuất hiện gần vùng kháng cự ngắn hạn." };
  return { zone: "middle", note: "Mẫu nến nằm giữa biên dao động gần đây." };
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
    return { isWide: true, note: "Biên nến rộng hơn bình thường, tín hiệu đáng chú ý hơn." };
  }

  return { isWide: false, note: "Biên nến chưa lớn hơn đáng kể so với gần đây." };
}

function getRangePosition(candles: OHLCV[], sourceIndex: number, close: number): PatternContext["rangePosition"] {
  const previous = candles.slice(Math.max(0, sourceIndex - 20), sourceIndex + 1);
  const low = Math.min(...previous.map((candle) => candle.low));
  const high = Math.max(...previous.map((candle) => candle.high));
  const range = Math.max(high - low, 0.01);
  const position = (close - low) / range;

  if (position <= 0.33) return "near-low";
  if (position >= 0.67) return "near-high";
  return "middle";
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

function dedupePatterns(patterns: PatternDraft[]): PatternDraft[] {
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
