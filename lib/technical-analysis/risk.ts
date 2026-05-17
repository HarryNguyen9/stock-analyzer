import { createSignal } from "@/lib/signals";
import type { AnalysisContext, Signal } from "@/lib/technical-analysis/types";

export function analyzeRisk(
  context: AnalysisContext,
  input: {
    sma20: number | null;
    sma50: number | null;
    rsi14: number | null;
    macdHistogram: number | null;
    volumeSpikeRatio: number | null;
  },
) {
  const brokenMA20 = Boolean(input.sma20 && context.previous.close >= input.sma20 && context.latest.close < input.sma20);
  const brokenMA50 = Boolean(input.sma50 && context.previous.close >= input.sma50 && context.latest.close < input.sma50);
  const rsiOverbought = input.rsi14 !== null && input.rsi14 > 70;
  const macdBearish = input.macdHistogram !== null && input.macdHistogram < 0;
  const heavySellingVolume = Boolean(
    input.volumeSpikeRatio !== null && input.volumeSpikeRatio >= 1.5 && context.latest.close < context.previous.close,
  );
  const signals: Signal[] = [];

  if (brokenMA20 || brokenMA50) {
    signals.push(
      createSignal({
        code: brokenMA50 ? "BROKEN_MA50" : "BROKEN_MA20",
        labelVi: brokenMA50 ? "Gãy MA50" : "Gãy MA20",
        descriptionVi: brokenMA50
          ? "Giá đóng cửa xuống dưới MA50, rủi ro xu hướng tăng lên."
          : "Giá đóng cửa xuống dưới MA20, nhịp ngắn hạn yếu đi.",
        explanationVi: brokenMA50
          ? "Giá mất đường trung bình trung hạn, cho thấy vùng hỗ trợ động quan trọng không còn giữ được."
          : "Giá mất đường trung bình ngắn hạn, cho thấy lực mua gần đây đang suy yếu.",
        implicationVi: brokenMA50
          ? "Tín hiệu này thường cần ưu tiên quản trị rủi ro vì xu hướng trung hạn có thể chuyển xấu."
          : "Đây là cảnh báo sớm; nên theo dõi liệu giá có lấy lại MA20 trong vài phiên tới hay không.",
        category: "risk",
        sentiment: "bearish",
        strength: brokenMA50 ? 5 : 4,
        priority: brokenMA50 ? 96 : 84,
      }),
    );
  }

  if (heavySellingVolume) {
    signals.push(
      createSignal({
        code: "HEAVY_SELLING_VOLUME",
        labelVi: "Volume bán mạnh",
        descriptionVi: "Phiên giảm đi kèm khối lượng cao hơn rõ rệt so với trung bình.",
        explanationVi: "Giá giảm trong khi thanh khoản tăng, cho thấy lực bán chủ động đang mạnh hơn bình thường.",
        implicationVi: "Tín hiệu này thường hàm ý áp lực phân phối hoặc thoát hàng ngắn hạn đang tăng.",
        category: "risk",
        sentiment: "bearish",
        strength: 5,
        priority: 95,
      }),
    );
  }

  if (macdBearish) {
    signals.push(
      createSignal({
        code: "MACD_BEARISH",
        labelVi: "MACD suy yếu",
        descriptionVi: "MACD histogram âm, động lượng ngắn hạn đang nghiêng về bên bán.",
        explanationVi: "Đường MACD đang thấp hơn đường tín hiệu, tạo histogram dưới mốc 0.",
        implicationVi: "Động lượng giảm đang chiếm ưu thế; nếu đi kèm gãy MA hoặc volume bán, rủi ro cao hơn.",
        category: "risk",
        sentiment: "bearish",
        strength: 4,
        priority: 82,
      }),
    );
  }

  return { brokenMA20, brokenMA50, rsiOverbought, macdBearish, heavySellingVolume, signals };
}
