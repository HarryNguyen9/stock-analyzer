import { createSignal } from "@/lib/signals";
import type { AnalysisContext, MacdSnapshot, Signal } from "@/lib/technical-analysis/types";
import { average, ema, latest, round, rsi } from "@/lib/technical-analysis/utils";

export function analyzeMomentum(context: AnalysisContext) {
  const rsi14 = latest(rsi(context.closes, 14));
  const macd = calculateMacd(context.closes);
  const roc10 = calculateRateOfChange(context.closes, 10);
  const adx14 = calculateAdx(context, 14);
  const stochasticRsi = calculateStochasticRsi(context.closes, 14);
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

  return { rsi14, macd, roc10, adx14, stochasticRsi, signals };
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

function calculateAdx(context: AnalysisContext, period: number): number | null {
  if (context.candles.length < period + 1) return null;

  const dxValues: number[] = [];

  for (let index = 1; index < context.candles.length; index += 1) {
    const current = context.candles[index];
    const previous = context.candles[index - 1];
    const upMove = current.high - previous.high;
    const downMove = previous.low - current.low;
    const plusDm = upMove > downMove && upMove > 0 ? upMove : 0;
    const minusDm = downMove > upMove && downMove > 0 ? downMove : 0;
    const trueRange = Math.max(
      current.high - current.low,
      Math.abs(current.high - previous.close),
      Math.abs(current.low - previous.close),
    );

    if (trueRange === 0) {
      continue;
    }

    const plusDi = (plusDm / trueRange) * 100;
    const minusDi = (minusDm / trueRange) * 100;
    const diTotal = plusDi + minusDi;

    if (diTotal > 0) {
      dxValues.push((Math.abs(plusDi - minusDi) / diTotal) * 100);
    }
  }

  return average(dxValues.slice(-period));
}

function calculateStochasticRsi(values: number[], period: number): number | null {
  const rsiValues = rsi(values, period).filter((value): value is number => value !== null);

  if (rsiValues.length < period) return null;

  const slice = rsiValues.slice(-period);
  const current = slice[slice.length - 1];
  const min = Math.min(...slice);
  const max = Math.max(...slice);

  if (max === min) return null;

  return round(((current - min) / (max - min)) * 100);
}
