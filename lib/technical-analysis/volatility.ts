import { createSignal } from "@/lib/signals";
import type { AnalysisContext, BollingerBandsSnapshot, Signal } from "@/lib/technical-analysis/types";
import { average, round, standardDeviation, trueRange } from "@/lib/technical-analysis/utils";

export function analyzeVolatility(context: AnalysisContext) {
  const bollingerBands20 = calculateBollingerBands(context.closes, 20);
  const atr14 = calculateAtr(context);
  const signals: Signal[] = [];

  if (bollingerBands20.squeeze) {
    signals.push(
      createSignal({
        code: "BOLLINGER_SQUEEZE",
        labelVi: "Bollinger squeeze",
        descriptionVi: "Dải Bollinger đang co hẹp, thị trường có thể chuẩn bị biến động mạnh.",
        explanationVi: "Biên độ dao động 20 phiên đang bị nén lại, khiến dải Bollinger hẹp hơn bình thường.",
        implicationVi: "Sau giai đoạn nén, giá thường có một nhịp biến động mạnh; cần chờ hướng breakout để xác nhận.",
        category: "volatility",
        sentiment: "neutral",
        strength: 3,
        priority: 68,
      }),
    );
  }

  return { bollingerBands20, atr14, signals };
}

function calculateBollingerBands(values: number[], period: number): BollingerBandsSnapshot {
  if (values.length < period) {
    return { upper: null, middle: null, lower: null, width: null, squeeze: false };
  }

  const slice = values.slice(-period);
  const middle = average(slice);
  const deviation = standardDeviation(slice);
  const upper = middle === null ? null : round(middle + deviation * 2);
  const lower = middle === null ? null : round(middle - deviation * 2);
  const width = middle && upper && lower ? round(((upper - lower) / middle) * 100) : null;

  return {
    upper,
    middle,
    lower,
    width,
    squeeze: width !== null && width < 8,
  };
}

function calculateAtr(context: AnalysisContext): number | null {
  if (context.candles.length < 15) return null;
  const ranges = context.candles.slice(-14).map((candle, index, slice) => {
    const globalIndex = context.candles.length - slice.length + index;
    return trueRange(candle, context.candles[globalIndex - 1] ?? null);
  });
  return average(ranges);
}
