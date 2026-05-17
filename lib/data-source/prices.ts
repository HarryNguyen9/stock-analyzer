import {
  getDataFreshness,
  getHistoricalPricesResult,
  getStockSummariesFromProvider,
} from "@/lib/data-source/provider";

export { getDataFreshness, getHistoricalPricesResult };

export const getStockSummaries = getStockSummariesFromProvider;

export async function getHistoricalPrices(symbol: string) {
  const result = await getHistoricalPricesResult(symbol);
  return result.status === "ready" ? result.data : [];
}
