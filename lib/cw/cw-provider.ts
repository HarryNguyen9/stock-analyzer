import { createSupabaseClient } from "@/lib/supabase/client";
import { attachCoveredWarrantMetrics, sortCoveredWarrants } from "@/lib/cw/cw-metrics";
import type { CoveredWarrantRecord, CoveredWarrantWithMetrics } from "@/lib/cw/types";

type CoveredWarrantRow = {
  symbol: string;
  underlying_symbol: string;
  issuer: string | null;
  type: string | null;
  strike_price: number | null;
  exercise_ratio: number | null;
  maturity_date: string | null;
  last_price: number | null;
  bid: number | null;
  ask: number | null;
  volume: number | null;
  open_interest: number | null;
  is_active: boolean;
  source: string | null;
  raw: Record<string, unknown> | null;
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
  source: "supabase";
  updatedAt: string | null;
  message: string | null;
};

export async function getCoveredWarrantsByUnderlying(underlying: string): Promise<CoveredWarrantSearchResult> {
  const normalizedUnderlying = normalizeUnderlying(underlying);
  const supabase = createSupabaseClient();

  if (!supabase) {
    return {
      underlying: normalizedUnderlying,
      warrants: [],
      source: "supabase",
      updatedAt: null,
      message: "Chưa cấu hình Supabase cho dữ liệu chứng quyền.",
    };
  }

  const { data, error } = await supabase
    .from("covered_warrants")
    .select("symbol, underlying_symbol, issuer, type, strike_price, exercise_ratio, maturity_date, last_price, bid, ask, volume, open_interest, is_active, source, raw, updated_at")
    .ilike("underlying_symbol", normalizedUnderlying)
    .eq("is_active", true)
    .order("volume", { ascending: false, nullsFirst: false })
    .order("maturity_date", { ascending: true, nullsFirst: false })
    .limit(100);

  if (error) {
    console.warn("Không đọc được covered_warrants từ Supabase:", error.message);
    return {
      underlying: normalizedUnderlying,
      warrants: [],
      source: "supabase",
      updatedAt: null,
      message: "Chưa có dữ liệu chứng quyền. Hãy chạy đồng bộ CW từ provider.",
    };
  }

  const rows = (data ?? []) as CoveredWarrantRow[];
  if (rows.length === 0) {
    const hasAnyData = await hasAnyCoveredWarrantData();

    return {
      underlying: normalizedUnderlying,
      warrants: [],
      source: "supabase",
      updatedAt: null,
      message: hasAnyData ? null : "Chưa có dữ liệu chứng quyền. Hãy chạy đồng bộ CW từ provider.",
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
    message: null,
  };
}

export async function searchCoveredWarrantUnderlyings(query: string, limit = 20): Promise<string[]> {
  const normalizedQuery = normalizeUnderlying(query);
  const supabase = createSupabaseClient();
  if (!supabase) return [];

  const request = supabase
    .from("covered_warrants")
    .select("underlying_symbol")
    .eq("is_active", true)
    .order("underlying_symbol", { ascending: true })
    .limit(Math.min(Math.max(limit * 5, limit), 200));

  const { data, error } = normalizedQuery
    ? await request.ilike("underlying_symbol", `${normalizedQuery}%`)
    : await request;

  if (error) {
    console.warn("Không đọc được danh sách mã cơ sở CW:", error.message);
    return [];
  }

  return [...new Set((data ?? []).map((row) => row.underlying_symbol).filter(Boolean))]
    .slice(0, limit);
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

async function hasAnyCoveredWarrantData(): Promise<boolean> {
  const supabase = createSupabaseClient();
  if (!supabase) return false;

  const { count, error } = await supabase
    .from("covered_warrants")
    .select("symbol", { count: "exact", head: true })
    .eq("is_active", true);

  if (error) return false;
  return (count ?? 0) > 0;
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
    source: row.source,
    raw: row.raw,
  };
}

function normalizeUnderlying(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}
