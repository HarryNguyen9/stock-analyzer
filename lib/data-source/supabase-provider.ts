import { createTechnicalSnapshot, debugTechnicalSnapshot } from "@/lib/data-source/technical-snapshot";
import { DEFAULT_HISTORICAL_CANDLE_LIMIT } from "@/lib/data-source/constants";
import { createSupabaseClient } from "@/lib/supabase/client";
import type { AppDataProvider } from "@/lib/data-source/provider";
import { isOHLCV, toStockSummary } from "@/lib/data-source/local-provider";
import type { OHLCV, StockExchange, StockMetadata, StockSummary } from "@/types/stock";

const PRICE_LIMIT = DEFAULT_HISTORICAL_CANDLE_LIMIT;

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
};

type TechnicalIndicatorRow = {
  technical_score: number | null;
  signals: unknown | null;
};

type UpdatedAtRow = {
  updated_at: string | null;
};

export type SymbolDataState = {
  isActive: boolean;
  syncStatus: string | null;
  unsupportedReason: string | null;
};

export type SupabaseUpdatedAtResult =
  | {
      available: true;
      updatedAt: string | null;
    }
  | {
      available: false;
      updatedAt: null;
    };

export const supabaseDataProvider: AppDataProvider = {
  async getPrices(symbol, options) {
    const data = await readSupabasePrices(symbol, options?.limit);

    if (!data || data.length < 50) {
      return {
        status: "error",
        source: "local-json",
        data: [],
        error: `${symbol}: Supabase chưa có đủ dữ liệu`,
      };
    }

    return {
      status: "ready",
      source: "supabase",
      data,
    };
  },
  async getSummaries() {
    const supabase = createSupabaseClient();

    if (!supabase) {
      return null;
    }

    const { data: symbols, error } = await supabase
      .from("symbols")
      .select("symbol,name,exchange,sector,tier,liquidity_rank,is_active")
      .eq("is_active", true)
      .order("symbol", { ascending: true })
      .limit(2000);

    if (error || !symbols || symbols.length === 0) {
      return null;
    }

    const symbolRows = symbols as unknown as SymbolRow[];
    const results = await Promise.all(
      symbolRows.map(async (row) => {
        const stock = {
          symbol: row.symbol,
          name: row.name,
          exchange: row.exchange,
          sector: row.sector,
          tier: row.tier,
          liquidityRank: row.liquidity_rank,
        };
        const data = await readSupabasePrices(stock.symbol);

        if (!data || data.length < 50) {
          return null;
        }

        const summary = toStockSummary(stock, {
          status: "ready",
          source: "supabase",
          data,
        });
        const technicalRow = await readLatestTechnicalSnapshot(stock.symbol);
        const technical = createTechnicalSnapshot(
          data,
          technicalRow?.technical_score ?? null,
          technicalRow?.signals ?? null,
        );
        debugTechnicalSnapshot(stock.symbol, "home", technical);

        return withTechnicalSnapshot(summary, technical);
      }),
    );

    const summaries = results.filter(isStockSummary);
    return summaries.length > 0 ? summaries : null;
  },
};

export async function readLatestSupabaseUpdatedAt(): Promise<SupabaseUpdatedAtResult> {
  const technicalUpdatedAt = await readLatestUpdatedAt("technical_indicators");

  if (technicalUpdatedAt.available && technicalUpdatedAt.updatedAt) {
    return technicalUpdatedAt;
  }

  const priceUpdatedAt = await readLatestUpdatedAt("stock_prices");

  if (priceUpdatedAt.available) {
    return priceUpdatedAt;
  }

  if (technicalUpdatedAt.available) {
    return technicalUpdatedAt;
  }

  return {
    available: false,
    updatedAt: null,
  };
}

async function readLatestUpdatedAt(
  table: "technical_indicators" | "stock_prices",
): Promise<SupabaseUpdatedAtResult> {
  const supabase = createSupabaseClient();

  if (!supabase) {
    return {
      available: false,
      updatedAt: null,
    };
  }

  try {
    if (table === "technical_indicators") {
      const { data, error } = await supabase
        .from("technical_indicators")
        .select("updated_at")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return toUpdatedAtResult(data as unknown as UpdatedAtRow | null, error);
    }

    const { data, error } = await supabase
      .from("stock_prices")
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return toUpdatedAtResult(data as unknown as UpdatedAtRow | null, error);
  } catch {
    return {
      available: false,
      updatedAt: null,
    };
  }
}

function toUpdatedAtResult(row: UpdatedAtRow | null, error: unknown): SupabaseUpdatedAtResult {
  if (error) {
    return {
      available: false,
      updatedAt: null,
    };
  }

  return {
    available: true,
    updatedAt: row?.updated_at ?? null,
  };
}

async function readSupabasePrices(symbol: string, limit = PRICE_LIMIT): Promise<OHLCV[] | null> {
  const supabase = createSupabaseClient();

  if (!supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("stock_prices")
      .select("date,open,high,low,close,volume")
      .eq("symbol", symbol)
      .order("date", { ascending: false })
      .limit(limit);

    if (error) {
      return null;
    }

    const priceRows = (data ?? []) as unknown as PriceRow[];

    return priceRows
      .map((row) => ({
        date: row.date,
        open: Number(row.open),
        high: Number(row.high),
        low: Number(row.low),
        close: Number(row.close),
        volume: Number(row.volume),
      }))
      .filter(isOHLCV)
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return null;
  }
}

export async function readLatestTechnicalScore(symbol: string): Promise<number | null> {
  const snapshot = await readLatestTechnicalSnapshot(symbol);
  return snapshot?.technical_score ?? null;
}

export async function readLatestTechnicalSnapshot(
  symbol: string,
): Promise<TechnicalIndicatorRow | null> {
  const supabase = createSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("technical_indicators")
    .select("technical_score,signals")
    .eq("symbol", symbol)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const scoreRow = data as unknown as TechnicalIndicatorRow | null;

  if (error || !scoreRow) {
    return null;
  }

  return scoreRow;
}

export async function getSymbolMetadata(symbol: string): Promise<StockMetadata | null> {
  const supabase = createSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("symbols")
    .select("symbol,name,exchange,sector,tier,liquidity_rank,is_active")
    .eq("symbol", symbol.toUpperCase())
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as unknown as SymbolRow;

  return {
    symbol: row.symbol,
    name: row.name,
    exchange: row.exchange,
    sector: row.sector,
    tier: row.tier,
    liquidityRank: row.liquidity_rank,
  };
}

export async function getSymbolDataState(symbol: string): Promise<SymbolDataState | null> {
  const supabase = createSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("symbols")
    .select("is_active,sync_status,unsupported_reason")
    .eq("symbol", symbol.toUpperCase())
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as unknown as {
    is_active: boolean | null;
    sync_status: string | null;
    unsupported_reason: string | null;
  };

  return {
    isActive: row.is_active !== false,
    syncStatus: row.sync_status,
    unsupportedReason: row.unsupported_reason,
  };
}

function withTechnicalSnapshot(
  summary: StockSummary,
  technical: ReturnType<typeof createTechnicalSnapshot>,
): StockSummary {
  return {
    ...summary,
    score: technical.score,
    status: technical.status,
    signal: technical.signals[0]?.labelVi ?? summary.signal,
    topSignals: technical.signals.slice(0, 2),
    scannerSignals: technical.signals,
  };
}

function isStockSummary(value: StockSummary | null): value is StockSummary {
  return value !== null;
}
