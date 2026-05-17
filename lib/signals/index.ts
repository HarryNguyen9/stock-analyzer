import type { Signal, SignalCategory, SignalSentiment } from "@/lib/technical-analysis/types";

export function createSignal(input: Signal): Signal {
  return normalizeSignalPriority(input);
}

export function topSignals(signals: Signal[], limit: number): Signal[] {
  return sortSignalsByPriority(signals).slice(0, limit);
}

export function sortSignalsByPriority(signals: Signal[]): Signal[] {
  return signals.map(normalizeSignalPriority).sort(
    (a, b) =>
      b.priority - a.priority ||
      b.strength - a.strength ||
      sentimentRank(b.sentiment) - sentimentRank(a.sentiment),
  );
}

export function normalizeSignalPriority(signal: Signal): Signal {
  const priority = getStandardPriority(signal);
  return priority === signal.priority ? signal : { ...signal, priority };
}

export function sentimentTone(sentiment: SignalSentiment): "positive" | "negative" | "neutral" {
  if (sentiment === "bullish") return "positive";
  if (sentiment === "bearish") return "negative";
  return "neutral";
}

export const categoryLabelsVi: Record<SignalCategory, string> = {
  trend: "Xu hướng",
  momentum: "Động lượng",
  volume: "Khối lượng",
  volatility: "Biến động",
  breakout: "Breakout",
  risk: "Rủi ro",
  pattern: "Mẫu hình",
};

function sentimentRank(sentiment: SignalSentiment): number {
  if (sentiment === "bearish") return 3;
  if (sentiment === "bullish") return 2;
  return 1;
}

function getStandardPriority(signal: Signal): number {
  const byCode: Partial<Record<string, number>> = {
    BREAKOUT_VOLUME_CONFIRM: 98,
    BROKEN_MA50: 96,
    HEAVY_SELLING_VOLUME: 95,
    BREAK_HIGH_20: 94,
    BREAK_LOW_20: 94,
    DEATH_CROSS: 88,
    GOLDEN_CROSS: 86,
    RSI_OVERBOUGHT: 84,
    RSI_OVERSOLD: 84,
    BROKEN_MA20: 84,
    MACD_BULLISH: 82,
    MACD_BEARISH: 82,
    PRICE_UP_VOLUME_UP: signal.strength >= 5 ? 86 : 78,
    TREND_UP_MA20_MA50: 72,
    PULLBACK_MA20: 70,
    BOLLINGER_SQUEEZE: 68,
    HIGHER_HIGH_HIGHER_LOW: 66,
    LOWER_HIGH_LOWER_LOW: 66,
    GAP_UP: 62,
    GAP_DOWN: 62,
    RSI_NEUTRAL_HEALTHY: 45,
    CONSOLIDATION_RANGE: 42,
  };

  if (typeof byCode[signal.code] === "number") {
    return byCode[signal.code];
  }

  if (signal.sentiment === "neutral") {
    return Math.min(signal.priority, 60);
  }

  if (signal.category === "risk" || signal.category === "breakout") {
    return Math.max(signal.priority, 80);
  }

  return signal.priority;
}
