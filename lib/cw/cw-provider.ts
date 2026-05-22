import { createSupabaseClient } from "@/lib/supabase/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { attachCoveredWarrantMetrics, sortCoveredWarrants } from "@/lib/cw/cw-metrics";
import { getCoveredWarrantProvider } from "@/lib/cw/providers/provider";
import type { Database, Json } from "@/lib/supabase/types";
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
  change_percent: number | null;
  bid: number | null;
  ask: number | null;
  volume: number | null;
  open_interest: number | null;
  underlying_price: number | null;
  sx_value: number | null;
  break_even_price: number | null;
  days_to_maturity: number | null;
  is_active: boolean;
  source: string | null;
  raw: Record<string, unknown> | null;
  updated_at: string;
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

  let { data, error } = await supabase
    .from("covered_warrants")
    .select("symbol, underlying_symbol, issuer, type, strike_price, exercise_ratio, maturity_date, last_price, change_percent, bid, ask, volume, open_interest, underlying_price, sx_value, break_even_price, days_to_maturity, is_active, source, raw, updated_at")
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

  let rows = (data ?? []) as CoveredWarrantRow[];

  if (rows.length === 0) {
    try {
      await syncCoveredWarrantsByUnderlying(normalizedUnderlying);
      const retry = await supabase
        .from("covered_warrants")
        .select("symbol, underlying_symbol, issuer, type, strike_price, exercise_ratio, maturity_date, last_price, change_percent, bid, ask, volume, open_interest, underlying_price, sx_value, break_even_price, days_to_maturity, is_active, source, raw, updated_at")
        .ilike("underlying_symbol", normalizedUnderlying)
        .eq("is_active", true)
        .order("volume", { ascending: false, nullsFirst: false })
        .order("maturity_date", { ascending: true, nullsFirst: false })
        .limit(100);

      if (!retry.error) {
        data = retry.data;
        rows = (data ?? []) as CoveredWarrantRow[];
      }
    } catch (syncError) {
      console.warn("Không sync được CW on-demand:", {
        underlying: normalizedUnderlying,
        error: syncError instanceof Error ? syncError.message : String(syncError),
      });
    }
  }

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

  const warrants = sortCoveredWarrants(
    attachCoveredWarrantMetrics(rows.map((row) => mapCoveredWarrantRow(row, row.underlying_price))),
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

type CoveredWarrantUpsert = Database["public"]["Tables"]["covered_warrants"]["Insert"];

async function syncCoveredWarrantsByUnderlying(underlying: string): Promise<number> {
  const provider = getCoveredWarrantProvider();
  const result = await provider.fetchCoveredWarrantsByUnderlying(underlying);

  if (result.warrants.length === 0) {
    return 0;
  }

  const now = new Date().toISOString();
  const rows: CoveredWarrantUpsert[] = result.warrants.map((warrant) => ({
    symbol: warrant.symbol,
    underlying_symbol: warrant.underlyingSymbol,
    issuer: warrant.issuer,
    type: warrant.type,
    strike_price: warrant.strikePrice,
    exercise_ratio: warrant.exerciseRatio,
    maturity_date: warrant.maturityDate,
    last_price: warrant.lastPrice,
    change_percent: warrant.changePercent,
    bid: warrant.bid,
    ask: warrant.ask,
    volume: warrant.volume,
    open_interest: warrant.openInterest,
    underlying_price: warrant.underlyingPrice,
    sx_value: warrant.sxValue,
    break_even_price: warrant.breakEvenPrice,
    days_to_maturity: warrant.daysToMaturity,
    is_active: warrant.isActive,
    source: warrant.source,
    raw: warrant.raw as Json | null,
    updated_at: now,
  }));

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("covered_warrants").upsert(rows, { onConflict: "symbol" });
  if (error) throw new Error(`Không upsert được covered_warrants theo mã cơ sở: ${error.message}`);

  return rows.length;
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
    changePercent: row.change_percent,
    bid: row.bid,
    ask: row.ask,
    volume: row.volume,
    openInterest: row.open_interest,
    sxValue: row.sx_value,
    breakEvenPrice: row.break_even_price,
    daysToMaturity: row.days_to_maturity,
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
