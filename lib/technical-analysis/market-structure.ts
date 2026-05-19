import type { MarketStructure } from "@/lib/technical-analysis/types";
import type { OHLCV } from "@/types/stock";

type SwingPoint = {
  index: number;
  value: number;
};

export function analyzeMarketStructure(candles: OHLCV[]): MarketStructure {
  if (candles.length < 8) {
    return {
      structureType: "unclear",
      shortTermBias: "neutral",
      keySwingHigh: null,
      keySwingLow: null,
      lastBreakType: "none",
      summaryVi: "Chưa có đủ dữ liệu để đọc cấu trúc giá ngắn hạn.",
    };
  }

  const recent = candles.slice(-60);
  const swingHighs = findSwingHighs(recent);
  const swingLows = findSwingLows(recent);
  const latest = recent[recent.length - 1];
  const previousSwingHigh = swingHighs.at(-1)?.value ?? highest(recent.slice(-20));
  const previousSwingLow = swingLows.at(-1)?.value ?? lowest(recent.slice(-20));
  const higherHigh = hasHigherSequence(swingHighs);
  const higherLow = hasHigherSequence(swingLows);
  const lowerHigh = hasLowerSequence(swingHighs);
  const lowerLow = hasLowerSequence(swingLows);
  const lastBreakType =
    previousSwingHigh !== null && latest.close > previousSwingHigh
      ? "breakout"
      : previousSwingLow !== null && latest.close < previousSwingLow
        ? "breakdown"
        : "none";
  const rangePercent = getRangePercent(recent.slice(-20));
  const rangeBound = rangePercent !== null && rangePercent <= 9 && lastBreakType === "none";
  const structureType = getStructureType({
    higherHigh,
    higherLow,
    lowerHigh,
    lowerLow,
    rangeBound,
    lastBreakType,
  });
  const shortTermBias = getShortTermBias(structureType, lastBreakType);

  return {
    structureType,
    shortTermBias,
    keySwingHigh: previousSwingHigh,
    keySwingLow: previousSwingLow,
    lastBreakType,
    summaryVi: createSummary(structureType, higherLow, lowerHigh, lastBreakType),
  };
}

function findSwingHighs(candles: OHLCV[]): SwingPoint[] {
  const swings: SwingPoint[] = [];

  for (let index = 2; index < candles.length - 2; index += 1) {
    const current = candles[index];

    if (
      current.high > candles[index - 1].high &&
      current.high > candles[index - 2].high &&
      current.high >= candles[index + 1].high &&
      current.high >= candles[index + 2].high
    ) {
      swings.push({ index, value: current.high });
    }
  }

  return swings;
}

function findSwingLows(candles: OHLCV[]): SwingPoint[] {
  const swings: SwingPoint[] = [];

  for (let index = 2; index < candles.length - 2; index += 1) {
    const current = candles[index];

    if (
      current.low < candles[index - 1].low &&
      current.low < candles[index - 2].low &&
      current.low <= candles[index + 1].low &&
      current.low <= candles[index + 2].low
    ) {
      swings.push({ index, value: current.low });
    }
  }

  return swings;
}

function hasHigherSequence(points: SwingPoint[]): boolean {
  if (points.length < 2) return false;
  const last = points.at(-1)!;
  const previous = points.at(-2)!;
  return last.value > previous.value;
}

function hasLowerSequence(points: SwingPoint[]): boolean {
  if (points.length < 2) return false;
  const last = points.at(-1)!;
  const previous = points.at(-2)!;
  return last.value < previous.value;
}

function getStructureType(input: {
  higherHigh: boolean;
  higherLow: boolean;
  lowerHigh: boolean;
  lowerLow: boolean;
  rangeBound: boolean;
  lastBreakType: MarketStructure["lastBreakType"];
}): MarketStructure["structureType"] {
  if (input.higherHigh && input.higherLow) return "uptrend";
  if (input.lowerHigh && input.lowerLow) return "downtrend";
  if (input.lastBreakType !== "none") return "transition";
  if (input.rangeBound) return "range";
  if ((input.higherHigh && input.lowerLow) || (input.lowerHigh && input.higherLow)) return "transition";
  return "unclear";
}

function getShortTermBias(
  structureType: MarketStructure["structureType"],
  lastBreakType: MarketStructure["lastBreakType"],
): MarketStructure["shortTermBias"] {
  if (lastBreakType === "breakout" || structureType === "uptrend") return "bullish";
  if (lastBreakType === "breakdown" || structureType === "downtrend") return "bearish";
  return "neutral";
}

function createSummary(
  structureType: MarketStructure["structureType"],
  higherLow: boolean,
  lowerHigh: boolean,
  lastBreakType: MarketStructure["lastBreakType"],
): string {
  if (lastBreakType === "breakout") {
    return "Giá có dấu hiệu phá vỡ lên trên swing high gần nhất; cấu trúc ngắn hạn nghiêng tích cực hơn.";
  }

  if (lastBreakType === "breakdown") {
    return "Giá có dấu hiệu phá vỡ xuống dưới swing low gần nhất; rủi ro cấu trúc tăng lên.";
  }

  if (structureType === "uptrend") {
    return higherLow
      ? "Cấu trúc giá đang nghiêng tích cực, giá vẫn giữ higher low."
      : "Cấu trúc giá nghiêng tích cực nhưng cần thêm xác nhận từ higher low.";
  }

  if (structureType === "downtrend") {
    return lowerHigh
      ? "Cấu trúc giá đang yếu, các nhịp hồi tạo lower high."
      : "Cấu trúc giá nghiêng yếu nhưng chưa có phá vỡ cấu trúc thật rõ.";
  }

  if (structureType === "range") {
    return "Giá đang dao động trong biên, chưa có phá vỡ cấu trúc rõ ràng.";
  }

  if (structureType === "transition") {
    return "Cấu trúc giá đang chuyển pha, tín hiệu chưa đồng thuận hoàn toàn.";
  }

  return "Chưa có phá vỡ cấu trúc rõ ràng, cần thêm dữ liệu giá xác nhận.";
}

function highest(candles: OHLCV[]): number | null {
  return candles.length > 0 ? Math.max(...candles.map((candle) => candle.high)) : null;
}

function lowest(candles: OHLCV[]): number | null {
  return candles.length > 0 ? Math.min(...candles.map((candle) => candle.low)) : null;
}

function getRangePercent(candles: OHLCV[]): number | null {
  if (candles.length === 0) return null;
  const high = highest(candles);
  const low = lowest(candles);
  const latest = candles[candles.length - 1].close;
  return high !== null && low !== null && latest > 0 ? ((high - low) / latest) * 100 : null;
}
