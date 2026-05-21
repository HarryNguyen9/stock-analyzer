import { generateMockOHLCV } from "./mock-generator";
import { DEFAULT_HISTORICAL_CANDLE_LIMIT } from "@/lib/data-source/constants";
import type { HistoricalPriceRequest, PriceProvider } from "./types";

export const fallbackProvider: PriceProvider = {
  name: "fallback-generated",
  async getDailyPrices(symbol, request = DEFAULT_HISTORICAL_CANDLE_LIMIT) {
    return generateMockOHLCV(symbol, getCandleLimit(request));
  },
};

function getCandleLimit(request: number | HistoricalPriceRequest): number {
  return typeof request === "number" ? request : (request.targetCandles ?? DEFAULT_HISTORICAL_CANDLE_LIMIT);
}
