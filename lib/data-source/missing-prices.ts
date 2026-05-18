import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

const SYMBOL_PAGE_SIZE = 1_000;
const PRICE_PAGE_SIZE = 1_000;
const PRICE_SCAN_LIMIT = 500_000;
const MIN_PRICE_ROWS = 20;
const DEFAULT_STALE_UPDATED_AT_MS = 7 * 24 * 60 * 60 * 1000;

type SymbolRow = Pick<Database["public"]["Tables"]["symbols"]["Row"], "symbol">;
type PriceRow = Pick<Database["public"]["Tables"]["stock_prices"]["Row"], "symbol" | "date" | "updated_at">;

export type MissingPriceReason = "too-few-rows" | "missing-latest-price" | "stale-updated-at";

export type MissingPriceSymbol = {
  symbol: string;
  priceRows: number;
  latestDate: string | null;
  latestUpdatedAt: string | null;
  reasons: MissingPriceReason[];
};

type MissingPriceOptions = {
  limit?: number;
  staleUpdatedAtMs?: number;
};

type PriceStats = {
  priceRows: number;
  latestDate: string | null;
  latestUpdatedAt: string | null;
};

export async function getSymbolsMissingPriceData(
  options: MissingPriceOptions = {},
): Promise<MissingPriceSymbol[]> {
  const limit = options.limit ?? Number.POSITIVE_INFINITY;
  const staleUpdatedAtMs = options.staleUpdatedAtMs ?? DEFAULT_STALE_UPDATED_AT_MS;
  const [symbols, prices] = await Promise.all([readSymbols(), readPricesForStats()]);
  const priceStats = toPriceStats(prices);
  const missing: MissingPriceSymbol[] = [];

  for (const row of symbols) {
    const stats = priceStats.get(row.symbol) ?? {
      priceRows: 0,
      latestDate: null,
      latestUpdatedAt: null,
    };
    const reasons = getMissingReasons(stats, staleUpdatedAtMs);

    if (reasons.length === 0) {
      continue;
    }

    missing.push({
      symbol: row.symbol,
      ...stats,
      reasons,
    });

    if (missing.length >= limit) {
      break;
    }
  }

  return missing;
}

async function readSymbols(): Promise<SymbolRow[]> {
  const supabase = createSupabaseAdminClient();
  const rows: SymbolRow[] = [];

  for (let from = 0; ; from += SYMBOL_PAGE_SIZE) {
    const to = from + SYMBOL_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("symbols")
      .select("symbol")
      .eq("is_active", true)
      .order("liquidity_rank", { ascending: true, nullsFirst: false })
      .order("symbol", { ascending: true })
      .range(from, to);

    if (error) {
      throw error;
    }

    rows.push(...((data ?? []) as SymbolRow[]).map((row) => ({ symbol: row.symbol.toUpperCase() })));

    if (!data || data.length < SYMBOL_PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

async function readPricesForStats(): Promise<PriceRow[]> {
  const supabase = createSupabaseAdminClient();
  const rows: PriceRow[] = [];

  for (let from = 0; from < PRICE_SCAN_LIMIT; from += PRICE_PAGE_SIZE) {
    const to = Math.min(from + PRICE_PAGE_SIZE - 1, PRICE_SCAN_LIMIT - 1);
    const { data, error } = await supabase
      .from("stock_prices")
      .select("symbol,date,updated_at")
      .order("symbol", { ascending: true })
      .order("date", { ascending: false })
      .range(from, to);

    if (error) {
      throw error;
    }

    rows.push(...((data ?? []) as PriceRow[]));

    if (!data || data.length < PRICE_PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

function toPriceStats(prices: PriceRow[]): Map<string, PriceStats> {
  const stats = new Map<string, PriceStats>();

  for (const row of prices) {
    const symbol = row.symbol.toUpperCase();
    const current = stats.get(symbol) ?? {
      priceRows: 0,
      latestDate: null,
      latestUpdatedAt: null,
    };

    current.priceRows += 1;

    if (!current.latestDate || row.date > current.latestDate) {
      current.latestDate = row.date;
      current.latestUpdatedAt = row.updated_at;
    }

    stats.set(symbol, current);
  }

  return stats;
}

function getMissingReasons(stats: PriceStats, staleUpdatedAtMs: number): MissingPriceReason[] {
  const reasons: MissingPriceReason[] = [];

  if (stats.priceRows < MIN_PRICE_ROWS) {
    reasons.push("too-few-rows");
  }

  if (!stats.latestDate) {
    reasons.push("missing-latest-price");
  }

  if (isStale(stats.latestUpdatedAt, staleUpdatedAtMs)) {
    reasons.push("stale-updated-at");
  }

  return reasons;
}

function isStale(value: string | null, staleUpdatedAtMs: number): boolean {
  if (!value) {
    return true;
  }

  const time = new Date(value).getTime();

  return !Number.isFinite(time) || Date.now() - time > staleUpdatedAtMs;
}
