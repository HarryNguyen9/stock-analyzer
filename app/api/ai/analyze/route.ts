import { analyzeWithAiProvider } from "@/lib/ai/provider";
import type { AiTechnicalAnalysis, AiTechnicalInput } from "@/lib/ai/types";
import { createTechnicalSnapshot } from "@/lib/data-source/technical-snapshot";
import { isOHLCV } from "@/lib/data-source/local-provider";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import type { OHLCV, StockExchange, StockMetadata } from "@/types/stock";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AnalyzeRequest = {
  symbol?: string;
  forceRefresh?: boolean;
};

type SymbolRow = {
  symbol: string;
  name: string;
  exchange: StockExchange;
  sector: string;
  tier: "A" | "B" | "C";
  liquidity_rank: number | null;
  is_active?: boolean;
};

type PriceRow = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  updated_at: string | null;
};

type TechnicalRow = {
  technical_score: number | null;
  signals: Json | null;
  updated_at: string | null;
};

type AiCacheEntry = {
  analysis: AiTechnicalAnalysis;
  input: AiTechnicalInput;
  cachedAt: number;
  dataUpdatedAt: string | null;
  technicalScore: number;
  scoreSource: AiTechnicalInput["scoreSource"];
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const FORCE_REFRESH_COOLDOWN_MS = 60 * 1000;
const aiCache = new Map<string, AiCacheEntry>();
const forceRefreshCooldown = new Map<string, number>();

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AnalyzeRequest;
    const symbol = normalizeSymbol(body.symbol);

    if (!symbol) {
      return Response.json({ ok: false, message: "Thiếu mã cổ phiếu." }, { status: 400 });
    }

    const input = await createAiInput(symbol);

    if (!input) {
      return Response.json({ ok: false, message: "Không tìm thấy dữ liệu kỹ thuật cho mã này." }, { status: 404 });
    }

    const cached = getCachedAnalysis(symbol, input, Boolean(body.forceRefresh));

    if (cached) {
      return Response.json({ ok: true, cached: true, ...cached });
    }

    if (body.forceRefresh && !canForceRefresh(symbol)) {
      const cooldown = getCachedAnalysis(symbol, input, false);

      if (cooldown) {
        return Response.json({ ok: true, cached: true, cooldown: true, ...cooldown });
      }
    }

    if (body.forceRefresh) {
      forceRefreshCooldown.set(symbol, Date.now());
    }

    const analysis = await analyzeWithAiProvider(input);
    const entry: AiCacheEntry = {
      analysis,
      input,
      cachedAt: Date.now(),
      dataUpdatedAt: input.dataUpdatedAt,
      technicalScore: input.technicalScore,
      scoreSource: input.scoreSource,
    };

    aiCache.set(symbol, entry);
    logAiScoreDiagnostics(input, analysis, false);

    return Response.json({ ok: true, cached: false, analysis, input });
  } catch (error) {
    console.error("AI analyze failed:", error);
    return Response.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Không phân tích được dữ liệu kỹ thuật.",
      },
      { status: 500 },
    );
  }
}

async function createAiInput(symbol: string): Promise<AiTechnicalInput | null> {
  const supabase = createSupabaseAdminClient();
  const { data: symbolData, error: symbolError } = await supabase
    .from("symbols")
    .select("symbol,name,exchange,sector,tier,liquidity_rank,is_active")
    .eq("symbol", symbol)
    .eq("is_active", true)
    .maybeSingle();

  if (symbolError || !symbolData) {
    return null;
  }

  const { data: priceRows, error: priceError } = await supabase
    .from("stock_prices")
    .select("date,open,high,low,close,volume,updated_at")
    .eq("symbol", symbol)
    .order("date", { ascending: false })
    .limit(220);

  if (priceError || !priceRows || priceRows.length < 2) {
    return null;
  }

  const candles = (priceRows as unknown as PriceRow[])
    .map(toOhlcv)
    .filter(isOHLCV)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-200);

  if (candles.length < 2) {
    return null;
  }

  const { data: technicalData } = await supabase
    .from("technical_indicators")
    .select("technical_score,signals,updated_at")
    .eq("symbol", symbol)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const technicalRow = technicalData as unknown as TechnicalRow | null;
  const snapshot = createTechnicalSnapshot(
    candles,
    technicalRow?.technical_score ?? null,
    technicalRow?.signals ?? null,
  );
  const latest = candles[candles.length - 1];
  const previous = candles[candles.length - 2];
  const metadata = toMetadata(symbolData as unknown as SymbolRow);
  const dataUpdatedAt = technicalRow?.updated_at ?? (priceRows[0] as unknown as PriceRow).updated_at ?? null;

  return {
    symbol,
    metadata,
    latestPrice: latest.close,
    changePercent: previous.close === 0 ? 0 : ((latest.close - previous.close) / previous.close) * 100,
    technicalScore: snapshot.score,
    scoreBreakdown: snapshot.analysis.scoreBreakdown,
    status: snapshot.status,
    scoreSource: snapshot.scoreSource,
    topSignals: snapshot.signals.slice(0, 6).map((signal) => ({
      code: signal.code,
      labelVi: signal.labelVi,
      descriptionVi: signal.descriptionVi,
      sentiment: signal.sentiment,
      strength: signal.strength,
      priority: signal.priority,
    })),
    dataUpdatedAt,
  };
}

function getCachedAnalysis(
  symbol: string,
  input: AiTechnicalInput,
  forceRefresh: boolean,
): { analysis: AiTechnicalAnalysis; input: AiTechnicalInput } | null {
  if (forceRefresh) {
    return null;
  }

  const cached = aiCache.get(symbol);

  if (!cached) {
    return null;
  }

  const freshByTime = Date.now() - cached.cachedAt <= CACHE_TTL_MS;
  const freshByData = !input.dataUpdatedAt || !cached.dataUpdatedAt || new Date(cached.dataUpdatedAt) >= new Date(input.dataUpdatedAt);
  const freshByScore = cached.technicalScore === input.technicalScore && cached.scoreSource === input.scoreSource;

  if (!freshByScore) {
    console.info("AI analysis cache invalidated by technical score change", {
      symbol,
      cachedScore: cached.technicalScore,
      modalScore: input.technicalScore,
      cachedScoreSource: cached.scoreSource,
      scoreSource: input.scoreSource,
    });
  }

  if (freshByTime && freshByData && freshByScore) {
    logAiScoreDiagnostics(input, cached.analysis, true);
    return { analysis: cached.analysis, input: cached.input };
  }

  return null;
}

function logAiScoreDiagnostics(input: AiTechnicalInput, analysis: AiTechnicalAnalysis, cached: boolean) {
  console.info("AI analysis score diagnostics", {
    symbol: input.symbol,
    modalScore: input.technicalScore,
    aiSummaryScore: analysis.diagnostics?.aiSummaryScore ?? null,
    scoreSource: input.scoreSource,
    cached,
  });
}

function canForceRefresh(symbol: string): boolean {
  const last = forceRefreshCooldown.get(symbol);
  return !last || Date.now() - last >= FORCE_REFRESH_COOLDOWN_MS;
}

function toOhlcv(row: PriceRow): OHLCV {
  return {
    date: row.date,
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
    volume: Number(row.volume),
  };
}

function toMetadata(row: SymbolRow): StockMetadata {
  return {
    symbol: row.symbol,
    name: row.name,
    exchange: row.exchange,
    sector: row.sector,
    tier: row.tier,
    liquidityRank: row.liquidity_rank,
  };
}

function normalizeSymbol(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const symbol = value.trim().toUpperCase();
  return /^[A-Z0-9]{2,12}$/.test(symbol) ? symbol : null;
}
