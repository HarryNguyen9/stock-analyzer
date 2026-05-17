import { createSignal } from "@/lib/signals";
import type { AnalysisContext, Signal } from "@/lib/technical-analysis/types";
import { highest, lowest } from "@/lib/technical-analysis/utils";

export function analyzeBreakout(context: AnalysisContext, sma20: number | null) {
  const previous20High = highest(context.highs.slice(-21, -1));
  const previous20Low = lowest(context.lows.slice(-21, -1));
  const breakHigh20 = previous20High !== null && context.latest.close > previous20High;
  const breakLow20 = previous20Low !== null && context.latest.close < previous20Low;
  const pullbackToMA20 = Boolean(
    sma20 &&
      context.latest.low <= sma20 * 1.01 &&
      context.latest.close >= sma20 &&
      context.latest.close >= context.latest.open,
  );
  const retestBreakoutZone = Boolean(
    previous20High &&
      context.previous.close > previous20High &&
      context.latest.low <= previous20High * 1.01 &&
      context.latest.close >= previous20High,
  );
  const signals: Signal[] = [];

  if (breakHigh20) {
    signals.push(
      createSignal({
        code: "BREAK_HIGH_20",
        labelVi: "Vượt đỉnh 20 phiên",
        descriptionVi: "Giá đóng cửa vượt vùng đỉnh 20 phiên gần nhất.",
        explanationVi: "Giá đã vượt qua vùng cao nhất của 20 phiên trước đó, phá vùng kháng cự ngắn hạn.",
        implicationVi: "Breakout có thể mở ra nhịp tăng mới, nhất là khi được xác nhận bởi khối lượng cao.",
        category: "breakout",
        sentiment: "bullish",
        strength: 4,
        priority: 94,
      }),
    );
  }

  if (breakLow20) {
    signals.push(
      createSignal({
        code: "BREAK_LOW_20",
        labelVi: "Gãy đáy 20 phiên",
        descriptionVi: "Giá đóng cửa thủng vùng đáy 20 phiên gần nhất.",
        explanationVi: "Giá rơi xuống dưới vùng thấp nhất của 20 phiên trước đó, phá vùng hỗ trợ ngắn hạn.",
        implicationVi: "Tín hiệu này thường cảnh báo rủi ro giảm tiếp hoặc cần hạ tỷ trọng quan sát.",
        category: "breakout",
        sentiment: "bearish",
        strength: 4,
        priority: 94,
      }),
    );
  }

  if (pullbackToMA20) {
    signals.push(
      createSignal({
        code: "PULLBACK_MA20",
        labelVi: "Pullback về MA20",
        descriptionVi: "Giá kiểm định MA20 và đóng cửa giữ được vùng này.",
        explanationVi: "Giá lùi về gần đường MA20 nhưng không đóng cửa thủng vùng hỗ trợ động này.",
        implicationVi: "Nếu xu hướng chính vẫn khỏe, đây có thể là nhịp nghỉ trước khi giá tiếp tục đi lên.",
        category: "breakout",
        sentiment: "bullish",
        strength: 3,
        priority: 70,
      }),
    );
  }

  return { breakHigh20, breakLow20, pullbackToMA20, retestBreakoutZone, signals };
}
