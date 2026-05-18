import { localDataProvider } from "@/lib/data-source/local-provider";
import { readLatestSupabaseUpdatedAt, supabaseDataProvider } from "@/lib/data-source/supabase-provider";
import { isSupabaseClientConfigured } from "@/lib/supabase/client";
import type { OHLCV, StockSummary } from "@/types/stock";

export type AppDataSource = "supabase" | "local-json" | "generated-fallback";

export type PriceDataResult =
  | {
      status: "ready";
      source: AppDataSource;
      data: OHLCV[];
    }
  | {
      status: "error";
      source: "local-json";
      data: [];
      error: string;
    };

export type AppDataProvider = {
  getPrices(symbol: string): Promise<PriceDataResult>;
  getSummaries?(): Promise<StockSummary[] | null>;
};

export type DataFreshnessStatus = "synced" | "stale" | "market-closed" | "local-fallback" | "empty";

export type DataFreshnessResult = {
  status: DataFreshnessStatus;
  updatedAt: string | null;
};

export async function getHistoricalPricesResult(symbol: string): Promise<PriceDataResult> {
  const supabaseResult = await supabaseDataProvider.getPrices(symbol);

  if (supabaseResult.status === "ready") {
    return supabaseResult;
  }

  return localDataProvider.getPrices(symbol);
}

export async function getStockSummariesFromProvider(): Promise<StockSummary[]> {
  const supabaseSummaries = await supabaseDataProvider.getSummaries?.();

  if (supabaseSummaries && supabaseSummaries.length > 0) {
    return supabaseSummaries;
  }

  if (isSupabaseClientConfigured()) {
    console.warn("Supabase is configured, so static local symbol metadata will not be used for stock summaries.");
    return [];
  }

  return (await localDataProvider.getSummaries?.()) ?? [];
}

export async function getDataFreshness(): Promise<DataFreshnessResult> {
  const latestUpdate = await readLatestSupabaseUpdatedAt();

  if (!latestUpdate.available) {
    return {
      status: "local-fallback",
      updatedAt: null,
    };
  }

  const updatedAt = latestUpdate.updatedAt;

  if (!updatedAt) {
    return {
      status: "empty",
      updatedAt: null,
    };
  }

  const updatedAtTime = new Date(updatedAt).getTime();

  if (!Number.isFinite(updatedAtTime)) {
    return {
      status: "empty",
      updatedAt: null,
    };
  }

  const thirtyMinutesMs = 30 * 60 * 1000;
  const isStale = Date.now() - updatedAtTime > thirtyMinutesMs;

  return {
    status: isStale ? (isVietnamWeekend() ? "market-closed" : "stale") : "synced",
    updatedAt,
  };
}

function isVietnamWeekend(): boolean {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "short",
  }).format(new Date());

  return weekday === "Sat" || weekday === "Sun";
}
