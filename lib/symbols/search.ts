import { readHomeScannerSnapshot } from "@/lib/scanner/snapshot";
import { sortSignalsByPriority } from "@/lib/signals";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import { vi } from "@/lib/i18n/vi";
import type { Signal } from "@/lib/technical-analysis/types";
import type { StockExchange, StockSummary } from "@/types/stock";

const DEFAULT_SEARCH_LIMIT = 30;
const MAX_SEARCH_LIMIT = 50;
const FEATURED_LIMIT = 20;
const PRICE_ROWS_PER_SYMBOL = 24;

type SymbolSearchRow = {
  symbol: string;
  name: string;
  exchange: StockExchange;
  sector: string;
  tier: "A" | "B" | "C";
  liquidity_rank: number | null;
};

type PriceSearchRow = {
  symbol: string;
  date: string;
  open: number;
  close: number;
  volume: number;
};

type TechnicalSearchRow = {
  symbol: string;
  technical_score: number | null;
  signals: Json | null;
};

export type SymbolSearchResult = {
  stocks: StockSummary[];
  source: "snapshot" | "supabase" | "empty";
  durationMs: number;
  limit: number;
};

export async function searchSymbols(input: {
  q?: string | null;
  limit?: number | null;
}): Promise<SymbolSearchResult> {
  const startedAt = Date.now();
  const query = normalizeQuery(input.q ?? "");
  const limit = clampLimit(input.limit);

  if (!query) {
    const stocks = await readFeaturedStocks(limit);
    return {
      stocks,
      source: stocks.length > 0 ? "snapshot" : "empty",
      durationMs: Date.now() - startedAt,
      limit,
    };
  }

  const supabase = createSupabaseAdminClient();
  const pattern = `%${escapeSearchPattern(query)}%`;
  const { data, error } = await supabase
    .from("symbols")
    .select("symbol,name,exchange,sector,tier,liquidity_rank")
    .eq("is_active", true)
    .or(`symbol.ilike.${pattern},name.ilike.${pattern},exchange.ilike.${pattern},sector.ilike.${pattern}`)
    .order("liquidity_rank", { ascending: true, nullsFirst: false })
    .order("symbol", { ascending: true })
    .limit(limit);

  if (error || !data || data.length === 0) {
    return {
      stocks: [],
      source: "supabase",
      durationMs: Date.now() - startedAt,
      limit,
    };
  }

  const rows = data as SymbolSearchRow[];
  const stocks = await hydrateSymbolRows(rows);

  return {
    stocks,
    source: "supabase",
    durationMs: Date.now() - startedAt,
    limit,
  };
}

function clampLimit(value: number | null | undefined): number {
  if (!value || !Number.isFinite(value)) {
    return DEFAULT_SEARCH_LIMIT;
  }

  return Math.max(1, Math.min(MAX_SEARCH_LIMIT, Math.floor(value)));
}

async function readFeaturedStocks(limit: number): Promise<StockSummary[]> {
  const snapshot = await readHomeScannerSnapshot();
  const bySymbol = new Map<string, StockSummary>();

  for (const group of snapshot ?? []) {
    for (const item of group.items) {
      if (!bySymbol.has(item.stock.symbol)) {
        bySymbol.set(item.stock.symbol, item.stock);
      }
    }
  }

  return [...bySymbol.values()].slice(0, Math.min(limit, FEATURED_LIMIT));
}

async function hydrateSymbolRows(rows: SymbolSearchRow[]): Promise<StockSummary[]> {
  const symbols = rows.map((row) => row.symbol);
  const [pricesBySymbol, technicalBySymbol] = await Promise.all([
    readRecentPrices(symbols),
    readLatestTechnical(symbols),
  ]);

  return rows.map((row) => {
    const prices = pricesBySymbol.get(row.symbol) ?? [];
    const latest = prices[0];
    const previous = prices[1];
    const technical = technicalBySymbol.get(row.symbol);
    const signals = sortSignalsByPriority(parseSignals(technical?.signals ?? null));
    const score = clampScore(technical?.technical_score ?? 0);

    if (!latest || !previous) {
      return {
        symbol: row.symbol,
        name: row.name,
        exchange: row.exchange,
        sector: row.sector,
        tier: row.tier,
        liquidityRank: row.liquidity_rank,
        lastClose: 0,
        dayChangePercent: 0,
        latestDate: "Chưa có",
        latestVolume: 0,
        avgVolume20: 0,
        avgTradedValue20: 0,
        score,
        status: getStatus(score),
        signal: "Chưa có dữ liệu giá",
        topSignals: [],
        scannerSignals: [],
        dataStatus: "error",
        dataError: "Chưa có dữ liệu giá",
      };
    }

    const avgVolume20 = average(prices.map((price) => price.volume));
    const avgTradedValue20 = average(prices.map((price) => price.close * 1000 * price.volume));

    return {
      symbol: row.symbol,
      name: row.name,
      exchange: row.exchange,
      sector: row.sector,
      tier: row.tier,
      liquidityRank: row.liquidity_rank,
      lastClose: latest.close,
      dayChangePercent: previous.close > 0 ? ((latest.close - previous.close) / previous.close) * 100 : 0,
      latestDate: latest.date,
      latestVolume: latest.volume,
      avgVolume20: Math.round(avgVolume20),
      avgTradedValue20: Math.round(avgTradedValue20),
      score,
      status: getStatus(score),
      signal: signals[0]?.labelVi ?? "Đang theo dõi",
      topSignals: signals.slice(0, 2),
      scannerSignals: signals,
      dataStatus: "ready",
    };
  });
}

async function readRecentPrices(symbols: string[]): Promise<Map<string, PriceSearchRow[]>> {
  if (symbols.length === 0) {
    return new Map();
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("stock_prices")
    .select("symbol,date,open,close,volume")
    .in("symbol", symbols)
    .order("date", { ascending: false })
    .limit(symbols.length * PRICE_ROWS_PER_SYMBOL);

  if (error || !data) {
    return new Map();
  }

  const grouped = new Map<string, PriceSearchRow[]>();

  for (const row of data as PriceSearchRow[]) {
    const prices = grouped.get(row.symbol) ?? [];

    if (prices.length < 20) {
      prices.push({
        symbol: row.symbol,
        date: row.date,
        open: Number(row.open),
        close: Number(row.close),
        volume: Number(row.volume),
      });
      grouped.set(row.symbol, prices);
    }
  }

  return grouped;
}

async function readLatestTechnical(symbols: string[]): Promise<Map<string, TechnicalSearchRow>> {
  if (symbols.length === 0) {
    return new Map();
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("technical_indicators")
    .select("symbol,technical_score,signals")
    .in("symbol", symbols)
    .order("date", { ascending: false })
    .limit(symbols.length * 3);

  if (error || !data) {
    return new Map();
  }

  const latest = new Map<string, TechnicalSearchRow>();

  for (const row of data as TechnicalSearchRow[]) {
    if (!latest.has(row.symbol)) {
      latest.set(row.symbol, row);
    }
  }

  return latest;
}

function parseSignals(value: unknown): Signal[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(toSignal).filter((signal): signal is Signal => signal !== null);
}

function toSignal(value: unknown): Signal | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (
    typeof record.code !== "string" ||
    typeof record.labelVi !== "string" ||
    typeof record.descriptionVi !== "string" ||
    typeof record.explanationVi !== "string" ||
    typeof record.implicationVi !== "string" ||
    !isSignalCategory(record.category) ||
    !isSignalSentiment(record.sentiment) ||
    !isSignalStrength(record.strength) ||
    typeof record.priority !== "number"
  ) {
    return null;
  }

  return {
    code: record.code,
    labelVi: record.labelVi,
    descriptionVi: record.descriptionVi,
    explanationVi: record.explanationVi,
    implicationVi: record.implicationVi,
    category: record.category,
    sentiment: record.sentiment,
    strength: record.strength,
    priority: record.priority,
  };
}

function isSignalCategory(value: unknown): value is Signal["category"] {
  return (
    value === "trend" ||
    value === "momentum" ||
    value === "volume" ||
    value === "volatility" ||
    value === "breakout" ||
    value === "risk" ||
    value === "pattern"
  );
}

function isSignalSentiment(value: unknown): value is Signal["sentiment"] {
  return value === "bullish" || value === "bearish" || value === "neutral";
}

function isSignalStrength(value: unknown): value is Signal["strength"] {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

function getStatus(score: number): StockSummary["status"] {
  if (score >= 70) return vi.score.constructive;
  if (score >= 45) return vi.score.neutral;
  return vi.score.weak;
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function average(values: number[]): number {
  const validValues = values.filter(Number.isFinite);

  if (validValues.length === 0) {
    return 0;
  }

  return validValues.reduce((total, value) => total + value, 0) / validValues.length;
}

function normalizeQuery(value: string): string {
  return value.trim();
}

function escapeSearchPattern(value: string): string {
  return value.replace(/[%_,()]/g, "");
}
