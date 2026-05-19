import { createSignal } from "@/lib/signals";
import type { AnalysisContext, CandlestickPatterns, Signal } from "@/lib/technical-analysis/types";
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
  const candlestickPatterns = detectCandlestickPatterns(context);
  const signals: Signal[] = [];

  if (higherHighHigherLow) {
    signals.push(
      createSignal({
        code: "HIGHER_HIGH_HIGHER_LOW",
        labelVi: "Đỉnh đáy nâng dần",
        descriptionVi: "Cấu trúc ngắn hạn đang tạo higher high và higher low.",
        explanationVi: "Các đỉnh sau cao hơn đỉnh trước và các đáy sau cũng cao hơn đáy trước.",
        implicationVi: "Cấu trúc này thường phản ánh xu hướng tăng đang hình thành hoặc được duy trì.",
        category: "pattern",
        sentiment: "bullish",
        strength: 3,
        priority: 66,
      }),
    );
  }

  if (lowerHighLowerLow) {
    signals.push(
      createSignal({
        code: "LOWER_HIGH_LOWER_LOW",
        labelVi: "Đỉnh đáy hạ dần",
        descriptionVi: "Cấu trúc ngắn hạn đang tạo lower high và lower low.",
        explanationVi: "Các nhịp hồi tạo đỉnh thấp hơn và các nhịp giảm tạo đáy thấp hơn.",
        implicationVi: "Cấu trúc này thường cho thấy bên bán đang kiểm soát nhịp giá ngắn hạn.",
        category: "pattern",
        sentiment: "bearish",
        strength: 3,
        priority: 66,
      }),
    );
  }

  if (consolidationRange) {
    signals.push(
      createSignal({
        code: "CONSOLIDATION_RANGE",
        labelVi: "Tích lũy biên hẹp",
        descriptionVi: "Giá đi ngang trong biên độ hẹp, phù hợp để theo dõi breakout.",
        explanationVi: "Biên dao động gần đây thu hẹp, giá chưa chọn hướng tăng hoặc giảm rõ ràng.",
        implicationVi: "Giai đoạn tích lũy có thể tạo nền cho breakout, nhưng cần chờ tín hiệu xác nhận.",
        category: "pattern",
        sentiment: "neutral",
        strength: 2,
        priority: 42,
      }),
    );
  }

  if (gapUp || gapDown) {
    signals.push(
      createSignal({
        code: gapUp ? "GAP_UP" : "GAP_DOWN",
        labelVi: gapUp ? "Gap up" : "Gap down",
        descriptionVi: gapUp ? "Giá mở khoảng trống tăng so với phiên trước." : "Giá mở khoảng trống giảm so với phiên trước.",
        explanationVi: gapUp
          ? "Vùng giá thấp nhất của phiên hiện tại cao hơn vùng giá cao nhất của phiên trước."
          : "Vùng giá cao nhất của phiên hiện tại thấp hơn vùng giá thấp nhất của phiên trước.",
        implicationVi: gapUp
          ? "Gap up thường cho thấy kỳ vọng tích cực đột ngột, nhưng cần xem giá có giữ được khoảng trống hay không."
          : "Gap down thường phản ánh áp lực bán mạnh, đặc biệt nếu giá không hồi lại vùng gap.",
        category: "pattern",
        sentiment: gapUp ? "bullish" : "bearish",
        strength: 3,
        priority: 62,
      }),
    );
  }

  return {
    higherHighHigherLow,
    lowerHighLowerLow,
    consolidationRange,
    gapUp,
    gapDown,
    candlestickPatterns,
    signals,
  };
}

function detectCandlestickPatterns(context: AnalysisContext): CandlestickPatterns {
  const latest = context.latest;
  const previous = context.previous;
  const range = Math.max(latest.high - latest.low, 0.01);
  const body = Math.abs(latest.close - latest.open);
  const upperShadow = latest.high - Math.max(latest.open, latest.close);
  const lowerShadow = Math.min(latest.open, latest.close) - latest.low;
  const isGreen = latest.close >= latest.open;
  const previousIsRed = previous.close < previous.open;
  const previousIsGreen = previous.close >= previous.open;
  const doji = body / range <= 0.1;
  const hammer = lowerShadow >= body * 2 && upperShadow <= body * 0.7 && body / range <= 0.35;
  const shootingStar = upperShadow >= body * 2 && lowerShadow <= body * 0.7 && body / range <= 0.35;
  const bullishEngulfing =
    previousIsRed &&
    isGreen &&
    latest.open <= previous.close &&
    latest.close >= previous.open;
  const bearishEngulfing =
    previousIsGreen &&
    !isGreen &&
    latest.open >= previous.close &&
    latest.close <= previous.open;

  return {
    doji,
    hammer,
    bullishEngulfing,
    bearishEngulfing,
    shootingStar,
  };
}
