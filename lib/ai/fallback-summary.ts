import type { AiTechnicalAnalysis, AiTechnicalInput } from "@/lib/ai/types";

const DISCLAIMER =
  "Phân tích này chỉ mang tính tham khảo kỹ thuật, không phải khuyến nghị mua/bán và ứng dụng không chịu trách nhiệm cho quyết định đầu tư.";

export function createFallbackTechnicalAnalysis(input: AiTechnicalInput): AiTechnicalAnalysis {
  const bullishSignals = input.topSignals.filter((signal) => signal.sentiment === "bullish");
  const riskSignals = input.topSignals.filter((signal) => signal.sentiment === "bearish");
  const sentiment = getSentiment(input);

  return {
    summary: `${input.symbol} đang ở trạng thái ${input.status.toLowerCase()} với điểm kỹ thuật ${input.technicalScore}/100. Biến động gần nhất là ${formatSigned(input.changePercent)}%.`,
    bullishPoints:
      bullishSignals.length > 0
        ? bullishSignals.slice(0, 3).map((signal) => `${signal.labelVi}: ${signal.descriptionVi}`)
        : ["Chưa có tín hiệu tích cực đủ mạnh, nên ưu tiên quan sát thêm xác nhận từ giá và khối lượng."],
    riskPoints:
      riskSignals.length > 0
        ? riskSignals.slice(0, 3).map((signal) => `${signal.labelVi}: ${signal.descriptionVi}`)
        : ["Rủi ro kỹ thuật chưa nổi bật, nhưng vẫn cần theo dõi phản ứng tại các vùng hỗ trợ/kháng cự gần nhất."],
    watchPoints: [
      `Theo dõi khả năng duy trì điểm kỹ thuật quanh vùng ${input.technicalScore}/100.`,
      "Quan sát khối lượng trong các phiên tới để xác nhận sức mạnh của tín hiệu hiện tại.",
      "Ưu tiên kiểm tra lại nếu xuất hiện tín hiệu breakout hoặc cảnh báo rủi ro mới.",
    ],
    disclaimer: DISCLAIMER,
    sentiment,
    source: "fallback",
    technicalScore: input.technicalScore,
    scoreSource: input.scoreSource,
    diagnostics: {
      aiSummaryScore: input.technicalScore,
    },
  };
}

function getSentiment(input: AiTechnicalInput): AiTechnicalAnalysis["sentiment"] {
  const hasStrongRisk = input.topSignals.some(
    (signal) => signal.sentiment === "bearish" && signal.priority >= 90,
  );

  if (hasStrongRisk || input.technicalScore < 45) {
    return "risk";
  }

  if (input.technicalScore >= 70) {
    return "positive";
  }

  return "neutral";
}

function formatSigned(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}
