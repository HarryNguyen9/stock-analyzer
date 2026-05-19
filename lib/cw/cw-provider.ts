import { SAMPLE_COVERED_WARRANTS } from "@/data/sample-covered-warrants";
import { createSupabaseClient } from "@/lib/supabase/client";
import { attachCoveredWarrantMetrics, sortCoveredWarrants } from "@/lib/cw/cw-metrics";
import type { CoveredWarrantRecord, CoveredWarrantWithMetrics } from "@/lib/cw/types";

type CoveredWarrantRow = {
  symbol: string;
  underlying_symbol: string;
  issuer: string;
  type: string;
  strike_price: number;
  exercise_ratio: number;
  maturity_date: string;
  last_price: number;
  bid: number | null;
  ask: number | null;
  volume: number;
  open_interest: number | null;
  is_active: boolean;
  updated_at: string;
};

type UnderlyingPriceRow = {
  symbol: string;
  close: number;
  date: string;
};

export type CoveredWarrantSearchResult = {
  underlying: string;
  warrants: CoveredWarrantWithMetrics[];
  source: "supabase" | "sample";
  updatedAt: string | null;
};

export async function getCoveredWarrantsByUnderlying(underlying: string): Promise<CoveredWarrantSearchResult> {
  const normalizedUnderlying = normalizeUnderlying(underlying);
  const supabase = createSupabaseClient();

  // Future provider boundary: replace or enrich this Supabase read with DNSE OpenAPI CW data,
  // then keep returning CoveredWarrantRecord so UI/metrics stay unchanged.
  if (!supabase) {
    return getSampleCoveredWarrants(normalizedUnderlying);
  }

  try {
    const { data, error } = await supabase
      .from("covered_warrants")
      .select("symbol, underlying_symbol, issuer, type, strike_price, exercise_ratio, maturity_date, last_price, bid, ask, volume, open_interest, is_active, updated_at")
      .eq("underlying_symbol", normalizedUnderlying)
      .eq("is_active", true)
      .order("volume", { ascending: false });

    if (error) {
      console.warn("covered_warrants Supabase unavailable, using sample data:", error.message);
      return getSampleCoveredWarrants(normalizedUnderlying);
    }

    const rows = (data ?? []) as CoveredWarrantRow[];
    if (rows.length === 0) {
      return {
        underlying: normalizedUnderlying,
        warrants: [],
        source: "supabase",
        updatedAt: null,
      };
    }

    const underlyingPrice = await readLatestUnderlyingPrice(normalizedUnderlying);
    const warrants = sortCoveredWarrants(
      attachCoveredWarrantMetrics(rows.map((row) => mapCoveredWarrantRow(row, underlyingPrice))),
    );

    return {
      underlying: normalizedUnderlying,
      warrants,
      source: "supabase",
      updatedAt: rows[0]?.updated_at ?? null,
    };
  } catch (error) {
    console.warn("covered_warrants provider failed, using sample data:", error);
    return getSampleCoveredWarrants(normalizedUnderlying);
  }
}

export function getSupportedSampleUnderlyings(): string[] {
  return [...new Set(SAMPLE_COVERED_WARRANTS.map((warrant) => warrant.underlyingSymbol))].sort();
}

function getSampleCoveredWarrants(underlying: string): CoveredWarrantSearchResult {
  const warrants = sortCoveredWarrants(
    attachCoveredWarrantMetrics(SAMPLE_COVERED_WARRANTS.filter((warrant) => warrant.underlyingSymbol === underlying && warrant.isActive)),
  );

  return {
    underlying,
    warrants,
    source: "sample",
    updatedAt: warrants[0]?.updatedAt ?? null,
  };
}

async function readLatestUnderlyingPrice(symbol: string): Promise<number | null> {
  const supabase = createSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("stock_prices")
    .select("symbol, close, date")
    .eq("symbol", symbol)
    .order("date", { ascending: false })
    .limit(1);

  if (error) {
    console.warn("Khong doc duoc gia co so cho chung quyen:", { symbol, error: error.message });
    return null;
  }

  const row = (data?.[0] ?? null) as UnderlyingPriceRow | null;
  return typeof row?.close === "number" ? row.close : null;
}

function mapCoveredWarrantRow(row: CoveredWarrantRow, underlyingPrice: number | null): CoveredWarrantRecord {
  return {
    symbol: row.symbol,
    underlyingSymbol: row.underlying_symbol,
    issuer: row.issuer,
    type: row.type,
    strikePrice: row.strike_price,
    exerciseRatio: row.exercise_ratio,
    maturityDate: row.maturity_date,
    lastPrice: row.last_price,
    bid: row.bid,
    ask: row.ask,
    volume: row.volume,
    openInterest: row.open_interest,
    isActive: row.is_active,
    updatedAt: row.updated_at,
    underlyingPrice,
  };
}

function normalizeUnderlying(value: string): string {
  return value.trim().toUpperCase();
}
