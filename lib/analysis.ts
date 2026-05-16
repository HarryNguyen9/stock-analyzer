import { sentimentTone } from "@/lib/signals";
import { generateTechnicalAnalysis } from "@/lib/technical-analysis";
import type { OHLCV, TechnicalAnalysis } from "@/types/stock";

export function analyzeTechnical(data: OHLCV[]): TechnicalAnalysis {
  const advanced = generateTechnicalAnalysis(data);
  const groupedSignals = ["trend", "momentum", "volume", "risk"].map((category) => {
    const signal =
      advanced.signals.find((item) => item.category === category) ??
      advanced.signals.find((item) => item.sentiment !== "neutral") ??
      advanced.signals[0];

    if (!signal) {
      return {
        title: getLegacyTitle(category),
        label: "Trung tính",
        detail: "Chưa có tín hiệu nổi bật.",
        tone: "neutral" as const,
      };
    }

    return {
      title: getLegacyTitle(category),
      label: signal.labelVi,
      detail: signal.descriptionVi,
      tone: sentimentTone(signal.sentiment),
    };
  });

  return {
    score: advanced.score,
    indicators: {
      sma20: advanced.indicators.sma20,
      sma50: advanced.indicators.sma50,
      rsi14: advanced.indicators.rsi14,
      volumeAverage20: advanced.indicators.volumeAverage20,
    },
    signals: groupedSignals,
    advancedSignals: advanced.signals,
    summaryVi: advanced.summaryVi,
  };
}

function getLegacyTitle(category: string): "Xu hướng" | "Động lượng" | "Khối lượng" | "Rủi ro" {
  if (category === "momentum") return "Động lượng";
  if (category === "volume") return "Khối lượng";
  if (category === "risk") return "Rủi ro";
  return "Xu hướng";
}
