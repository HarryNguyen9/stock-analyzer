import {
  getDataFreshness,
  getHistoricalPricesResult,
  getStockSummariesFromProvider,
} from "@/lib/data-source/provider";
import type { StockSymbol } from "@/types/stock";

export { getDataFreshness, getHistoricalPricesResult };

export const getStockSummaries = getStockSummariesFromProvider;

export async function getHistoricalPrices(symbol: StockSymbol) {
  const result = await getHistoricalPricesResult(symbol);
  return result.status === "ready" ? result.data : [];
}
