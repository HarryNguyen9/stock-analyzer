import type { Signal, SignalCategory, SignalSentiment } from "@/lib/technical-analysis/types";

export function createSignal(input: Signal): Signal {
  return input;
}

export function topSignals(signals: Signal[], limit: number): Signal[] {
  return [...signals]
    .sort((a, b) => b.priority - a.priority || b.strength - a.strength)
    .slice(0, limit);
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
