import { createSupabaseClient } from "@/lib/supabase/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { attachCoveredWarrantMetrics, sortCoveredWarrants } from "@/lib/cw/cw-metrics";
import { getCoveredWarrantProvider } from "@/lib/cw/providers/provider";
import type { Database, Json } from "@/lib/supabase/types";
import type { CoveredWarrantRecord, CoveredWarrantWithMetrics } from "@/lib/cw/types";

const cwOnDemandStaleMinutes = 10;

type CoveredWarrantRow = {
  symbol: string;
  underlying_symbol: string;
  issuer: string | null;
  type: string | null;
  strike_price: number | null;
  exercise_ratio: number | null;
  issue_date: string | null;
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

export type CoveredWarrantDetailResult = {
  warrant: CoveredWarrantWithMetrics | null;
  related: CoveredWarrantWithMetrics[];
  source: "supabase";
  updatedAt: string | null;
  message: string | null;
};

const coveredWarrantSelect =
  "symbol, underlying_symbol, issuer, type, strike_price, exercise_ratio, issue_date, maturity_date, last_price, change_percent, bid, ask, volume, open_interest, underlying_price, sx_value, break_even_price, days_to_maturity, is_active, source, raw, updated_at";

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
    .select(coveredWarrantSelect)
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

  if (rows.length === 0 || isCoveredWarrantDataStale(rows)) {
    try {
      const syncedCount = await syncCoveredWarrantsByUnderlying(normalizedUnderlying);

      if (syncedCount > 0) {
        const retry = await supabase
          .from("covered_warrants")
          .select(coveredWarrantSelect)
          .ilike("underlying_symbol", normalizedUnderlying)
          .eq("is_active", true)
          .order("volume", { ascending: false, nullsFirst: false })
          .order("maturity_date", { ascending: true, nullsFirst: false })
          .limit(100);

        if (!retry.error) {
          rows = (retry.data ?? []) as CoveredWarrantRow[];
        }
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
    updatedAt: getLatestCoveredWarrantUpdatedAt(rows),
    message: null,
  };
}

export async function getCoveredWarrantBySymbol(symbol: string): Promise<CoveredWarrantDetailResult> {
  const normalizedSymbol = normalizeUnderlying(symbol);
  const supabase = createSupabaseClient();

  if (!supabase) {
    return {
      warrant: null,
      related: [],
      source: "supabase",
      updatedAt: null,
      message: "Chưa cấu hình Supabase cho dữ liệu chứng quyền.",
    };
  }

  const { data, error } = await supabase
    .from("covered_warrants")
    .select(coveredWarrantSelect)
    .eq("symbol", normalizedSymbol)
    .maybeSingle();

  if (error) {
    console.warn("Không đọc được chi tiết covered_warrants từ Supabase:", error.message);
    return {
      warrant: null,
      related: [],
      source: "supabase",
      updatedAt: null,
      message: "Không tải được dữ liệu chứng quyền.",
    };
  }

  if (!data) {
    return {
      warrant: null,
      related: [],
      source: "supabase",
      updatedAt: null,
      message: "Không tìm thấy mã chứng quyền này.",
    };
  }

  let row = data as CoveredWarrantRow;

  if (!row.issue_date || !row.maturity_date) {
    try {
      const syncedCount = await syncCoveredWarrantsByUnderlying(row.underlying_symbol);

      if (syncedCount > 0) {
        const retry = await supabase
          .from("covered_warrants")
          .select(coveredWarrantSelect)
          .eq("symbol", normalizedSymbol)
          .maybeSingle();

        if (!retry.error && retry.data) {
          row = retry.data as CoveredWarrantRow;
        }
      }
    } catch (syncError) {
      console.warn("Khong sync duoc chi tiet CW on-demand:", {
        symbol: normalizedSymbol,
        error: syncError instanceof Error ? syncError.message : String(syncError),
      });
    }
  }

  const relatedResult = await getCoveredWarrantsByUnderlying(row.underlying_symbol);
  const fallbackWarrant = attachCoveredWarrantMetrics([mapCoveredWarrantRow(row, row.underlying_price)])[0] ?? null;
  const warrant = relatedResult.warrants.find((item) => item.symbol === normalizedSymbol) ?? fallbackWarrant;

  return {
    warrant,
    related: relatedResult.warrants,
    source: "supabase",
    updatedAt: row.updated_at ?? relatedResult.updatedAt,
    message: null,
  };
}

export async function searchCoveredWarrantUnderlyings(query: string, limit = 200): Promise<string[]> {
  const normalizedQuery = normalizeUnderlying(query);
  const supabase = createSupabaseClient();
  if (!supabase) return [];

  const request = supabase
    .from("covered_warrants")
    .select("underlying_symbol")
    .eq("is_active", true)
    .order("underlying_symbol", { ascending: true })
    .limit(Math.min(Math.max(limit * 10, limit), 1000));

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

export async function searchCoveredWarrants(query: string, limit = 8): Promise<CoveredWarrantWithMetrics[]> {
  const normalizedQuery = normalizeUnderlying(query);
  const supabase = createSupabaseClient();
  if (!supabase || normalizedQuery.length === 0) return [];

  const safeLimit = Math.min(Math.max(limit, 1), 20);
  const { data, error } = await supabase
    .from("covered_warrants")
    .select(coveredWarrantSelect)
    .eq("is_active", true)
    .or(`symbol.ilike.${normalizedQuery}%,underlying_symbol.ilike.${normalizedQuery}%`)
    .order("volume", { ascending: false, nullsFirst: false })
    .order("maturity_date", { ascending: true, nullsFirst: false })
    .limit(safeLimit);

  if (error) {
    console.warn("Khong doc duoc danh sach CW de tim nhanh:", error.message);
    return [];
  }

  return sortCoveredWarrants(
    attachCoveredWarrantMetrics(((data ?? []) as CoveredWarrantRow[]).map((row) => mapCoveredWarrantRow(row, row.underlying_price))),
  ).slice(0, safeLimit);
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
    issue_date: warrant.issueDate,
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
    issueDate: row.issue_date,
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

function isCoveredWarrantDataStale(rows: CoveredWarrantRow[]): boolean {
  const latestUpdatedAt = getLatestCoveredWarrantUpdatedAt(rows);
  if (!latestUpdatedAt) return true;

  const updatedAtMs = new Date(latestUpdatedAt).getTime();
  if (!Number.isFinite(updatedAtMs)) return true;

  return Date.now() - updatedAtMs > cwOnDemandStaleMinutes * 60 * 1000;
}

function getLatestCoveredWarrantUpdatedAt(rows: CoveredWarrantRow[]): string | null {
  return rows.reduce<string | null>((latest, row) => {
    if (!row.updated_at) return latest;
    if (!latest) return row.updated_at;
    return new Date(row.updated_at).getTime() > new Date(latest).getTime() ? row.updated_at : latest;
  }, null);
}
