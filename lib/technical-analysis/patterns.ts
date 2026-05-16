import { createSignal } from "@/lib/signals";
import type { AnalysisContext, Signal } from "@/lib/technical-analysis/types";
import { highest, lowest, round } from "@/lib/technical-analysis/utils";

export function analyzePatterns(context: AnalysisContext) {
  const recent = context.candles.slice(-6);
  const firstHalf = recent.slice(0, 3);
  const secondHalf = recent.slice(3);
  const higherHighHigherLow = Boolean(
    highest(secondHalf.map((candle) => candle.high))! > highest(firstHalf.map((candle) => candle.high))! &&
      lowest(secondHalf.map((candle) => candle.low))! > lowest(firstHalf.map((candle) => candle.low))!,
  );
  const lowerHighLowerLow = Boolean(
    highest(secondHalf.map((candle) => candle.high))! < highest(firstHalf.map((candle) => candle.high))! &&
      lowest(secondHalf.map((candle) => candle.low))! < lowest(firstHalf.map((candle) => candle.low))!,
  );
  const rangeHigh = highest(context.highs.slice(-15));
  const rangeLow = lowest(context.lows.slice(-15));
  const consolidationRange = Boolean(
    rangeHigh && rangeLow && round(((rangeHigh - rangeLow) / context.latest.close) * 100) <= 7,
  );
  const gapUp = context.latest.low > context.previous.high;
  const gapDown = context.latest.high < context.previous.low;
  const signals: Signal[] = [];

  if (higherHighHigherLow) {
    signals.push(
      createSignal({
        code: "HIGHER_HIGH_HIGHER_LOW",
        labelVi: "Đỉnh đáy nâng dần",
        descriptionVi: "Cấu trúc ngắn hạn đang tạo higher high và higher low.",
        category: "pattern",
        sentiment: "bullish",
        strength: 3,
        priority: 68,
      }),
    );
  }

  if (lowerHighLowerLow) {
    signals.push(
      createSignal({
        code: "LOWER_HIGH_LOWER_LOW",
        labelVi: "Đỉnh đáy hạ dần",
        descriptionVi: "Cấu trúc ngắn hạn đang tạo lower high và lower low.",
        category: "pattern",
        sentiment: "bearish",
        strength: 3,
        priority: 68,
      }),
    );
  }

  if (consolidationRange) {
    signals.push(
      createSignal({
        code: "CONSOLIDATION_RANGE",
        labelVi: "Tích lũy biên hẹp",
        descriptionVi: "Giá đi ngang trong biên độ hẹp, phù hợp để theo dõi breakout.",
        category: "pattern",
        sentiment: "neutral",
        strength: 2,
        priority: 58,
      }),
    );
  }

  if (gapUp || gapDown) {
    signals.push(
      createSignal({
        code: gapUp ? "GAP_UP" : "GAP_DOWN",
        labelVi: gapUp ? "Gap up" : "Gap down",
        descriptionVi: gapUp ? "Giá mở khoảng trống tăng so với phiên trước." : "Giá mở khoảng trống giảm so với phiên trước.",
        category: "pattern",
        sentiment: gapUp ? "bullish" : "bearish",
        strength: 3,
        priority: 66,
      }),
    );
  }

  return { higherHighHigherLow, lowerHighLowerLow, consolidationRange, gapUp, gapDown, signals };
}
