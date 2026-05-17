import { createSignal } from "@/lib/signals";
import type { AnalysisContext, MacdSnapshot, Signal } from "@/lib/technical-analysis/types";
import { ema, latest, round, rsi } from "@/lib/technical-analysis/utils";

export function analyzeMomentum(context: AnalysisContext) {
  const rsi14 = latest(rsi(context.closes, 14));
  const macd = calculateMacd(context.closes);
  const roc10 = calculateRateOfChange(context.closes, 10);
  const signals: Signal[] = [];

  if (rsi14 !== null && rsi14 >= 45 && rsi14 <= 65) {
    signals.push(
      createSignal({
        code: "RSI_NEUTRAL_HEALTHY",
        labelVi: "RSI trung tính",
        descriptionVi: `RSI14 ở ${rsi14}, động lượng đang cân bằng.`,
        explanationVi: "RSI nằm trong vùng trung tính, chưa cho thấy bên mua hoặc bên bán quá áp đảo.",
        implicationVi: "Mã này có thể đang tích lũy hoặc chờ thêm tín hiệu xác nhận từ giá và khối lượng.",
        category: "momentum",
        sentiment: "neutral",
        strength: 3,
        priority: 45,
      }),
    );
  }

  if (rsi14 !== null && rsi14 > 70) {
    signals.push(
      createSignal({
        code: "RSI_OVERBOUGHT",
        labelVi: "RSI quá mua",
        descriptionVi: `RSI14 ở ${rsi14}, giá có thể đang hơi nóng.`,
        explanationVi: "RSI vượt vùng 70, cho thấy lực mua gần đây đã đẩy động lượng lên mức cao.",
        implicationVi: "Giá vẫn có thể tăng tiếp, nhưng rủi ro rung lắc hoặc chốt lời ngắn hạn cao hơn.",
        category: "momentum",
        sentiment: "bearish",
        strength: 3,
        priority: 84,
      }),
    );
  }

  if (rsi14 !== null && rsi14 < 30) {
    signals.push(
      createSignal({
        code: "RSI_OVERSOLD",
        labelVi: "RSI quá bán",
        descriptionVi: `RSI14 ở ${rsi14}, lực bán đã kéo giá về vùng yếu.`,
        explanationVi: "RSI rơi dưới vùng 30, cho thấy áp lực bán ngắn hạn đang khá mạnh.",
        implicationVi: "Mã này có thể xuất hiện nhịp hồi kỹ thuật, nhưng cần tín hiệu xác nhận trước khi coi là đảo chiều.",
        category: "momentum",
        sentiment: "neutral",
        strength: 3,
        priority: 84,
      }),
    );
  }

  if (macd.histogram !== null && macd.histogram > 0) {
    signals.push(
      createSignal({
        code: "MACD_BULLISH",
        labelVi: "MACD tích cực",
        descriptionVi: "MACD histogram dương, động lượng ngắn hạn đang cải thiện.",
        explanationVi: "Đường MACD đang cao hơn đường tín hiệu, tạo histogram phía trên mốc 0.",
        implicationVi: "Động lượng tăng đang cải thiện; nếu giá cũng vượt kháng cự, tín hiệu sẽ đáng tin hơn.",
        category: "momentum",
        sentiment: "bullish",
        strength: 4,
        priority: 82,
      }),
    );
  }

  return { rsi14, macd, roc10, signals };
}

function calculateMacd(values: number[]): MacdSnapshot {
  const ema12 = ema(values, 12);
  const ema26 = ema(values, 26);
  const macdSeries = values.map((_, index) =>
    ema12[index] !== null && ema26[index] !== null ? round(ema12[index]! - ema26[index]!) : null,
  );
  const signalSeries = ema(macdSeries.map((value) => value ?? 0), 9).map((value, index) =>
    macdSeries[index] === null ? null : value,
  );
  const macd = latest(macdSeries);
  const signal = latest(signalSeries);

  return {
    macd,
    signal,
    histogram: macd !== null && signal !== null ? round(macd - signal) : null,
  };
}

function calculateRateOfChange(values: number[], period: number): number | null {
  if (values.length <= period) return null;
  const current = values[values.length - 1];
  const previous = values[values.length - 1 - period];
  return previous === 0 ? null : round(((current - previous) / previous) * 100);
}
