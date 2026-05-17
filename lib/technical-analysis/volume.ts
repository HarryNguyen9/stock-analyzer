import { createSignal } from "@/lib/signals";
import type { AnalysisContext, Signal } from "@/lib/technical-analysis/types";
import { average, round } from "@/lib/technical-analysis/utils";

export function analyzeVolume(context: AnalysisContext, breakHigh20: boolean) {
  const volumeAverage20 = average(context.volumes.slice(-20));
  const volumeSpikeRatio = volumeAverage20 ? round(context.latest.volume / volumeAverage20, 2) : null;
  const priceUpWithVolumeUp =
    context.latest.close > context.previous.close && context.latest.volume > context.previous.volume;
  const breakoutVolumeConfirmation = Boolean(breakHigh20 && volumeSpikeRatio !== null && volumeSpikeRatio >= 1.3);
  const signals: Signal[] = [];

  if (volumeSpikeRatio !== null && priceUpWithVolumeUp && volumeSpikeRatio >= 1.2) {
    signals.push(
      createSignal({
        code: "PRICE_UP_VOLUME_UP",
        labelVi: "Giá tăng kèm volume",
        descriptionVi: `Khối lượng đạt ${volumeSpikeRatio}x trung bình 20 phiên trong phiên tăng.`,
        explanationVi: "Giá đóng cửa tăng trong khi thanh khoản cao hơn rõ rệt so với mặt bằng gần đây.",
        implicationVi: "Dòng tiền đang tham gia tích cực hơn; tín hiệu sẽ mạnh hơn nếu xuất hiện gần vùng breakout.",
        category: "volume",
        sentiment: "bullish",
        strength: volumeSpikeRatio >= 1.8 ? 5 : 4,
        priority: volumeSpikeRatio >= 1.8 ? 86 : 78,
      }),
    );
  }

  if (breakoutVolumeConfirmation) {
    signals.push(
      createSignal({
        code: "BREAKOUT_VOLUME_CONFIRM",
        labelVi: "Volume xác nhận breakout",
        descriptionVi: "Giá vượt vùng đỉnh ngắn hạn với khối lượng cao hơn trung bình.",
        explanationVi: "Breakout xảy ra cùng lúc với thanh khoản tăng, cho thấy lực mua không chỉ là biến động mỏng.",
        implicationVi: "Đây thường là tín hiệu xác nhận tốt cho xu hướng tăng, nhưng vẫn nên theo dõi phiên retest sau đó.",
        category: "volume",
        sentiment: "bullish",
        strength: 5,
        priority: 98,
      }),
    );
  }

  return { volumeAverage20, volumeSpikeRatio, priceUpWithVolumeUp, breakoutVolumeConfirmation, signals };
}
