import { localDataProvider } from "@/lib/data-source/local-provider";
import { readLatestPendingIntradayUpdatedAt, readLatestSupabaseUpdatedAt, supabaseDataProvider } from "@/lib/data-source/supabase-provider";
import {
  isVietnamAfterMarketClose,
  isVietnamMarketIntradayWindow,
  isVietnamWeekend,
} from "@/lib/data-source/vietnam-market-time";
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
      source: AppDataSource;
      data: [];
      error: string;
    };

export type AppDataProvider = {
  getPrices(symbol: string, options?: HistoricalPriceOptions): Promise<PriceDataResult>;
  getSummaries?(): Promise<StockSummary[] | null>;
};

export type HistoricalPriceOptions = {
  limit?: number;
};

export type DataFreshnessStatus = "synced" | "intraday" | "stale" | "market-closed" | "local-fallback" | "empty";

export type DataFreshnessResult = {
  status: DataFreshnessStatus;
  updatedAt: string | null;
};

export async function getHistoricalPricesResult(
  symbol: string,
  options?: HistoricalPriceOptions,
): Promise<PriceDataResult> {
  const supabaseResult = await supabaseDataProvider.getPrices(symbol, options);

  if (supabaseResult.status === "ready") {
    return supabaseResult;
  }

  if (isSupabaseClientConfigured()) {
    return supabaseResult;
  }

  return localDataProvider.getPrices(symbol, options);
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
  const pendingIntraday = await readLatestPendingIntradayUpdatedAt();

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
  const hasValidPendingIntraday =
    Boolean(pendingIntraday.updatedAt) && (isVietnamMarketIntradayWindow() || isVietnamAfterMarketClose());

  return {
    status: isStale ? (isVietnamWeekend() ? "market-closed" : "stale") : hasValidPendingIntraday ? "intraday" : "synced",
    updatedAt,
  };
}
