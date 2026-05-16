import { createSignal } from "@/lib/signals";
import type { AnalysisContext, Signal } from "@/lib/technical-analysis/types";
import { ema, latest, sma } from "@/lib/technical-analysis/utils";

export function analyzeTrend(context: AnalysisContext) {
  const sma20Series = sma(context.closes, 20);
  const sma50Series = sma(context.closes, 50);
  const sma200Series = sma(context.closes, 200);
  const ema20Series = ema(context.closes, 20);
  const ema50Series = ema(context.closes, 50);
  const sma20 = latest(sma20Series);
  const sma50 = latest(sma50Series);
  const sma200 = latest(sma200Series);
  const ema20 = latest(ema20Series);
  const ema50 = latest(ema50Series);
  const goldenCross = crossedUp(sma20Series, sma50Series);
  const deathCross = crossedDown(sma20Series, sma50Series);
  const signals: Signal[] = [];

  if (sma20 && sma50 && context.latest.close > sma20 && sma20 > sma50) {
    signals.push(
      createSignal({
        code: "TREND_UP_MA20_MA50",
        labelVi: "Xu hướng tăng",
        descriptionVi: "Giá nằm trên MA20 và MA20 đang cao hơn MA50.",
        category: "trend",
        sentiment: "bullish",
        strength: 4,
        priority: 95,
      }),
    );
  }

  if (goldenCross) {
    signals.push(
      createSignal({
        code: "GOLDEN_CROSS",
        labelVi: "Golden Cross",
        descriptionVi: "MA20 vừa cắt lên MA50, tín hiệu xu hướng tích cực.",
        category: "trend",
        sentiment: "bullish",
        strength: 5,
        priority: 100,
      }),
    );
  }

  if (deathCross) {
    signals.push(
      createSignal({
        code: "DEATH_CROSS",
        labelVi: "Death Cross",
        descriptionVi: "MA20 vừa cắt xuống MA50, xu hướng cần thận trọng.",
        category: "trend",
        sentiment: "bearish",
        strength: 5,
        priority: 100,
      }),
    );
  }

  return { sma20, sma50, sma200, ema20, ema50, goldenCross, deathCross, signals };
}

function crossedUp(fast: Array<number | null>, slow: Array<number | null>): boolean {
  const last = fast.length - 1;
  return Boolean(
    fast[last] !== null &&
      slow[last] !== null &&
      fast[last - 1] !== null &&
      slow[last - 1] !== null &&
      fast[last - 1]! <= slow[last - 1]! &&
      fast[last]! > slow[last]!,
  );
}

function crossedDown(fast: Array<number | null>, slow: Array<number | null>): boolean {
  const last = fast.length - 1;
  return Boolean(
    fast[last] !== null &&
      slow[last] !== null &&
      fast[last - 1] !== null &&
      slow[last - 1] !== null &&
      fast[last - 1]! >= slow[last - 1]! &&
      fast[last]! < slow[last]!,
  );
}
