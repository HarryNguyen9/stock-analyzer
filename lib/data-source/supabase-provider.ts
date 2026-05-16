import { STOCKS } from "@/data/symbols";
import { createSupabaseClient } from "@/lib/supabase/client";
import type { AppDataProvider } from "@/lib/data-source/provider";
import { isOHLCV, toStockSummary } from "@/lib/data-source/local-provider";
import { vi } from "@/lib/i18n/vi";
import type { OHLCV, StockSummary, StockSymbol } from "@/types/stock";

const PRICE_LIMIT = 220;
const STOCK_BY_SYMBOL = new Map(STOCKS.map((stock) => [stock.symbol, stock]));

type SymbolRow = {
  symbol: string;
  name: string;
  exchange: "HOSE" | "HNX" | "UPCOM";
  sector: string;
};

type PriceRow = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type TechnicalScoreRow = {
  technical_score: number | null;
};

export const supabaseDataProvider: AppDataProvider = {
  async getPrices(symbol) {
    const data = await readSupabasePrices(symbol);

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
      .select("symbol,name,exchange,sector")
      .order("symbol", { ascending: true });

    if (error || !symbols || symbols.length === 0) {
      return null;
    }

    const symbolRows = symbols as unknown as SymbolRow[];
    const results = await Promise.all(
      symbolRows.map(async (row) => {
        if (!isKnownSymbol(row.symbol)) {
          return null;
        }

        const stock = {
          symbol: row.symbol,
          name: row.name,
          exchange: row.exchange,
          sector: row.sector,
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

        const score = await readLatestTechnicalScore(stock.symbol);
        return score === null ? summary : withSupabaseScore(summary, score);
      }),
    );

    return results.every(isStockSummary) ? results : null;
  },
};

async function readSupabasePrices(symbol: StockSymbol): Promise<OHLCV[] | null> {
  const supabase = createSupabaseClient();

  if (!supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("stock_prices")
      .select("date,open,high,low,close,volume")
      .eq("symbol", symbol)
      .order("date", { ascending: true })
      .limit(PRICE_LIMIT);

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
      .slice(-200);
  } catch {
    return null;
  }
}

async function readLatestTechnicalScore(symbol: StockSymbol): Promise<number | null> {
  const supabase = createSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("technical_indicators")
    .select("technical_score")
    .eq("symbol", symbol)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const scoreRow = data as unknown as TechnicalScoreRow | null;

  if (error || typeof scoreRow?.technical_score !== "number") {
    return null;
  }

  return scoreRow.technical_score;
}

function withSupabaseScore(summary: StockSummary, score: number): StockSummary {
  return {
    ...summary,
    score,
    status: score >= 70 ? vi.score.constructive : score >= 45 ? vi.score.neutral : vi.score.weak,
  };
}

function isKnownSymbol(symbol: string): symbol is StockSymbol {
  return STOCK_BY_SYMBOL.has(symbol as StockSymbol);
}

function isStockSummary(value: StockSummary | null): value is StockSummary {
  return value !== null;
}
