import { generateMockOHLCV } from "./mock-generator";
import { DEFAULT_HISTORICAL_CANDLE_LIMIT } from "@/lib/data-source/constants";
import type { PriceProvider } from "./types";

export const fallbackProvider: PriceProvider = {
  name: "fallback-generated",
  async getDailyPrices(symbol, limit = DEFAULT_HISTORICAL_CANDLE_LIMIT) {
    return generateMockOHLCV(symbol, limit);
  },
};
