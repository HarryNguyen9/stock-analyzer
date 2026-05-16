import { localDataProvider } from "@/lib/data-source/local-provider";
import { supabaseDataProvider } from "@/lib/data-source/supabase-provider";
import type { OHLCV, StockSummary, StockSymbol } from "@/types/stock";

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
  getPrices(symbol: StockSymbol): Promise<PriceDataResult>;
  getSummaries?(): Promise<StockSummary[] | null>;
};

export async function getHistoricalPricesResult(symbol: StockSymbol): Promise<PriceDataResult> {
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

  return (await localDataProvider.getSummaries?.()) ?? [];
}
