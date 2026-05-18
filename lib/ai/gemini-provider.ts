import { createFallbackTechnicalAnalysis } from "@/lib/ai/fallback-summary";
import { formatTechnicalScore, normalizeTechnicalScore } from "@/lib/ai/score-format";
import type { AiProvider, AiTechnicalAnalysis, AiTechnicalInput } from "@/lib/ai/types";

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-1.5-flash";

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

export const geminiProvider: AiProvider = {
  name: "gemini",
  async analyzeTechnical(input) {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return createFallbackTechnicalAnalysis(input);
    }

    const model = process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
    const response = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: buildPrompt(input) }],
          },
        ],
        generationConfig: {
          temperature: 0.25,
          maxOutputTokens: 900,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error ${response.status}`);
    }

    const payload = (await response.json()) as GeminiResponse;
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error("Gemini không trả về nội dung phân tích.");
    }

    return normalizeGeminiResult(JSON.parse(text), input);
  },
};

function buildPrompt(input: AiTechnicalInput): string {
  return `Bạn là trợ lý phân tích kỹ thuật cổ phiếu Việt Nam.

Chỉ phân tích dựa trên dữ liệu được cung cấp bên dưới.
Không bịa giá, không bịa tin tức, không dùng thông tin ngoài dữ liệu.
Không khuyến nghị mua/bán. Không dự đoán chắc chắn.
Trả lời tiếng Việt, ngắn gọn, dễ đọc trên mobile.
Điểm kỹ thuật bắt buộc hiển thị chính xác là ${formatTechnicalScore(input.technicalScore)}, không tự thay đổi.

Dữ liệu canonical cho AI modal:
${JSON.stringify(buildPromptContext(input), null, 2)}

Trả về JSON đúng schema:
{
  "summary": "string",
  "bullishPoints": ["string"],
  "riskPoints": ["string"],
  "watchPoints": ["string"],
  "disclaimer": "string",
  "sentiment": "positive" | "neutral" | "risk"
}`;
}

function buildPromptContext(input: AiTechnicalInput) {
  return {
    symbol: input.symbol,
    metadata: input.metadata,
    latestPrice: input.latestPrice,
    changePercent: input.changePercent,
    technicalScore: normalizeTechnicalScore(input.technicalScore),
    scoreSource: input.scoreSource,
    status: input.status,
    topSignals: input.topSignals,
    dataUpdatedAt: input.dataUpdatedAt,
  };
}

function normalizeGeminiResult(value: unknown, input: AiTechnicalInput): AiTechnicalAnalysis {
  if (!isRecord(value)) {
    throw new Error("Gemini response không đúng JSON object.");
  }

  return {
    summary: getString(value.summary),
    bullishPoints: getStringArray(value.bullishPoints),
    riskPoints: getStringArray(value.riskPoints),
    watchPoints: getStringArray(value.watchPoints),
    disclaimer: getString(value.disclaimer),
    sentiment: value.sentiment === "positive" || value.sentiment === "risk" ? value.sentiment : "neutral",
    source: "gemini",
    technicalScore: normalizeTechnicalScore(input.technicalScore),
    scoreSource: input.scoreSource,
    diagnostics: {
      aiSummaryScore: null,
    },
  };
}

function getString(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "Chưa có nội dung.";
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 4);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
