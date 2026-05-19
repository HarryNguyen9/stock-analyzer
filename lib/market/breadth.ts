import { getStockSummaries } from "@/lib/data-source/prices";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import type { StockSummary } from "@/types/stock";

export const MARKET_BREADTH_SNAPSHOT_TYPE = "market_breadth";

export type MarketBreadthSnapshot = {
  totalSymbols: number;
  advancers: number;
  decliners: number;
  unchanged: number;
  advanceDeclineRatio: number | null;
  percentAboveSMA20: number;
  percentAboveSMA50: number;
  averageChangePercent: number;
  medianChangePercent: number;
  newHigh20: number;
  newLow20: number;
};

type PriceRow = {
  symbol: string;
  date: string;
  close: number;
};

type SnapshotRow = {
  data: Json;
  updated_at?: string | null;
};

const PRICE_PAGE_SIZE = 1_000;
const PRICE_SCAN_LIMIT = 100_000;
const MAX_PRICES_PER_SYMBOL = 50;

export async function refreshMarketBreadthSnapshot(stocks?: StockSummary[]): Promise<boolean> {
  try {
    const sourceStocks = stocks ?? await getStockSummaries();
    const pricesBySymbol = await readRecentPricesBySymbol();
    const breadth = buildMarketBreadth(sourceStocks, pricesBySymbol);
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("market_snapshots").upsert(
      {
        snapshot_type: MARKET_BREADTH_SNAPSHOT_TYPE,
        data: breadth as unknown as Json,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "snapshot_type" },
    );

    if (error) {
      throw error;
    }

    console.info("market_breadth snapshot updated:", {
      totalSymbols: breadth.totalSymbols,
      advancers: breadth.advancers,
      decliners: breadth.decliners,
    });

    return true;
  } catch (error) {
    console.warn("Khong cap nhat duoc market_breadth snapshot:", error);
    return false;
  }
}

export async function readMarketBreadthSnapshot(currentStocks: StockSummary[] = []): Promise<MarketBreadthSnapshot> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("market_snapshots")
      .select("data,updated_at")
      .eq("snapshot_type", MARKET_BREADTH_SNAPSHOT_TYPE)
      .maybeSingle();

    if (error || !data) {
      return buildMarketBreadth(currentStocks, new Map());
    }

    const row = data as SnapshotRow;
    const breadth = parseMarketBreadth(row.data);

    return breadth ?? buildMarketBreadth(currentStocks, new Map());
  } catch (error) {
    console.warn("Khong doc duoc market_breadth snapshot, fallback runtime breadth:", error);
    return buildMarketBreadth(currentStocks, new Map());
  }
}

export function buildMarketBreadth(
  stocks: StockSummary[],
  pricesBySymbol: Map<string, PriceRow[]>,
): MarketBreadthSnapshot {
  const readyStocks = stocks.filter((stock) => stock.dataStatus === "ready");
  const changes = readyStocks.map((stock) => stock.dayChangePercent).filter(Number.isFinite);
  let aboveSma20 = 0;
  let aboveSma20Total = 0;
  let aboveSma50 = 0;
  let aboveSma50Total = 0;
  let newHigh20 = 0;
  let newLow20 = 0;

  for (const stock of readyStocks) {
    const prices = pricesBySymbol.get(stock.symbol) ?? [];
    const latest = prices[0]?.close ?? stock.lastClose;
    const sma20 = calculateSma(prices, 20);
    const sma50 = calculateSma(prices, 50);
    const last20 = prices.slice(0, 20).map((price) => price.close).filter(Number.isFinite);

    if (sma20 !== null) {
      aboveSma20Total += 1;
      if (latest > sma20) aboveSma20 += 1;
    }

    if (sma50 !== null) {
      aboveSma50Total += 1;
      if (latest > sma50) aboveSma50 += 1;
    }

    if (last20.length >= 20) {
      if (latest >= Math.max(...last20)) newHigh20 += 1;
      if (latest <= Math.min(...last20)) newLow20 += 1;
    }
  }

  const advancers = readyStocks.filter((stock) => stock.dayChangePercent > 0).length;
  const decliners = readyStocks.filter((stock) => stock.dayChangePercent < 0).length;
  const unchanged = readyStocks.length - advancers - decliners;

  return {
    totalSymbols: readyStocks.length,
    advancers,
    decliners,
    unchanged,
    advanceDeclineRatio: decliners > 0 ? advancers / decliners : advancers > 0 ? advancers : null,
    percentAboveSMA20: aboveSma20Total > 0 ? (aboveSma20 / aboveSma20Total) * 100 : 0,
    percentAboveSMA50: aboveSma50Total > 0 ? (aboveSma50 / aboveSma50Total) * 100 : 0,
    averageChangePercent: average(changes),
    medianChangePercent: median(changes),
    newHigh20,
    newLow20,
  };
}

async function readRecentPricesBySymbol(): Promise<Map<string, PriceRow[]>> {
  const supabase = createSupabaseAdminClient();
  const grouped = new Map<string, PriceRow[]>();

  for (let from = 0; from < PRICE_SCAN_LIMIT; from += PRICE_PAGE_SIZE) {
    const to = Math.min(from + PRICE_PAGE_SIZE - 1, PRICE_SCAN_LIMIT - 1);
    const { data, error } = await supabase
      .from("stock_prices")
      .select("symbol,date,close")
      .order("date", { ascending: false })
      .range(from, to);

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as PriceRow[];

    for (const row of rows) {
      const symbol = row.symbol.toUpperCase();
      const prices = grouped.get(symbol) ?? [];

      if (prices.length < MAX_PRICES_PER_SYMBOL) {
        prices.push({
          symbol,
          date: row.date,
          close: Number(row.close),
        });
        grouped.set(symbol, prices);
      }
    }

    if (!data || data.length < PRICE_PAGE_SIZE) {
      break;
    }
  }

  return grouped;
}

function calculateSma(prices: PriceRow[], length: number): number | null {
  const values = prices.slice(0, length).map((price) => price.close).filter(Number.isFinite);

  if (values.length < length) {
    return null;
  }

  return average(values);
}

function parseMarketBreadth(value: unknown): MarketBreadthSnapshot | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.totalSymbols !== "number" ||
    typeof value.advancers !== "number" ||
    typeof value.decliners !== "number" ||
    typeof value.unchanged !== "number" ||
    typeof value.percentAboveSMA20 !== "number" ||
    typeof value.percentAboveSMA50 !== "number" ||
    typeof value.averageChangePercent !== "number" ||
    typeof value.medianChangePercent !== "number" ||
    typeof value.newHigh20 !== "number" ||
    typeof value.newLow20 !== "number"
  ) {
    return null;
  }

  return {
    totalSymbols: value.totalSymbols,
    advancers: value.advancers,
    decliners: value.decliners,
    unchanged: value.unchanged,
    advanceDeclineRatio: typeof value.advanceDeclineRatio === "number" ? value.advanceDeclineRatio : null,
    percentAboveSMA20: value.percentAboveSMA20,
    percentAboveSMA50: value.percentAboveSMA50,
    averageChangePercent: value.averageChangePercent,
    medianChangePercent: value.medianChangePercent,
    newHigh20: value.newHigh20,
    newLow20: value.newLow20,
  };
}

function average(values: number[]): number {
  const validValues = values.filter(Number.isFinite);

  if (validValues.length === 0) {
    return 0;
  }

  return validValues.reduce((total, value) => total + value, 0) / validValues.length;
}

function median(values: number[]): number {
  const validValues = values.filter(Number.isFinite).sort((a, b) => a - b);

  if (validValues.length === 0) {
    return 0;
  }

  const middle = Math.floor(validValues.length / 2);

  return validValues.length % 2 === 0
    ? (validValues[middle - 1] + validValues[middle]) / 2
    : validValues[middle];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
