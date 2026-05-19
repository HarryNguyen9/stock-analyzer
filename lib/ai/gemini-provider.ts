import { createFallbackTechnicalAnalysis } from "@/lib/ai/fallback-summary";
import { formatTechnicalScore } from "@/lib/ai/score-format";
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

type GeminiRequestResult =
  | {
      ok: true;
      analysis: AiTechnicalAnalysis;
    }
  | {
      ok: false;
      status: number | null;
    };

export const geminiProvider: AiProvider = {
  name: "gemini",
  async analyzeTechnical(input) {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return withProviderDiagnostics(createFallbackTechnicalAnalysis(input), null, false, null);
    }

    const model = process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
    const fallbackModel = process.env.GEMINI_FALLBACK_MODEL;
    const primary = await requestGeminiAnalysis({
      apiKey,
      model,
      input,
      fallbackModelUsed: false,
      providerErrorStatus: null,
    });

    if (primary.ok) {
      return primary.analysis;
    }

    if (primary.status === 404 && fallbackModel && fallbackModel !== model) {
      const fallback = await requestGeminiAnalysis({
        apiKey,
        model: fallbackModel,
        input,
        fallbackModelUsed: true,
        providerErrorStatus: primary.status,
      });

      if (fallback.ok) {
        return fallback.analysis;
      }
    }

    return withProviderDiagnostics(createFallbackTechnicalAnalysis(input), null, false, primary.status);
  },
};

async function requestGeminiAnalysis({
  apiKey,
  model,
  input,
  fallbackModelUsed,
  providerErrorStatus,
}: {
  apiKey: string;
  model: string;
  input: AiTechnicalInput;
  fallbackModelUsed: boolean;
  providerErrorStatus: number | null;
}): Promise<GeminiRequestResult> {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildRequestBody(input)),
      });

      if (!response.ok) {
        const responseBody = await response.text().catch(() => "");
        console.warn("Gemini API request failed", {
          model,
          status: response.status,
          attempt,
          responseBody,
        });

        if (response.status === 503 && attempt < maxAttempts) {
          await delay(350 * attempt);
          continue;
        }

        return { ok: false, status: response.status };
      }

      const payload = (await response.json()) as GeminiResponse;
      const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        console.warn("Gemini API response missing text", { model, attempt });
        return { ok: false, status: null };
      }

      return {
        ok: true,
        analysis: withProviderDiagnostics(
          normalizeGeminiResult(JSON.parse(text), input),
          model,
          fallbackModelUsed,
          providerErrorStatus,
        ),
      };
    } catch (error) {
      console.warn("Gemini API request errored", {
        model,
        attempt,
        error,
      });

      if (attempt < maxAttempts) {
        await delay(350 * attempt);
        continue;
      }

      return { ok: false, status: null };
    }
  }

  return { ok: false, status: null };
}

function buildRequestBody(input: AiTechnicalInput) {
  return {
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
  };
}

function withProviderDiagnostics(
  analysis: AiTechnicalAnalysis,
  modelUsed: string | null,
  fallbackModelUsed: boolean,
  providerErrorStatus: number | null,
): AiTechnicalAnalysis {
  const diagnostics = analysis.diagnostics;

  return {
    ...analysis,
    diagnostics: {
      ...diagnostics,
      aiSummaryScore: diagnostics?.aiSummaryScore ?? null,
      modelUsed,
      fallbackModelUsed,
      providerErrorStatus,
    },
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildPrompt(input: AiTechnicalInput): string {
  return `Bạn là trợ lý phân tích kỹ thuật cổ phiếu Việt Nam.

Chỉ phân tích dựa trên dữ liệu được cung cấp bên dưới.
Không bịa giá, không bịa tin tức, không dùng thông tin ngoài dữ liệu.
Không khuyến nghị mua/bán. Không dự đoán chắc chắn.
Trả lời tiếng Việt, ngắn gọn, dễ đọc trên mobile.
Nếu nhắc đến điểm kỹ thuật, bắt buộc dùng đúng technicalScore trong dữ liệu, không tự tính lại.
Điểm kỹ thuật bắt buộc hiển thị chính xác là ${formatTechnicalScore(input.technicalScore)}.

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
    technicalScore: input.technicalScore,
    scoreSource: input.scoreSource,
    status: input.status,
    topSignals: input.topSignals,
    advancedIndicators: input.advancedIndicators,
    supportResistance: input.supportResistance,
    methodSummaries: input.methodSummaries,
    technicalThesis: input.technicalThesis,
    priceBehavior: input.priceBehavior,
    interpretationGuardVi:
      "Khi diễn giải mẫu nến và Wyckoff-lite, dùng wording thận trọng như nghiêng về, có dấu hiệu, chưa đủ xác nhận; không kết luận chắc chắn.",
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
    technicalScore: input.technicalScore,
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
