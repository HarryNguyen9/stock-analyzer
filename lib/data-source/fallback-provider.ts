import { generateMockOHLCV } from "./mock-generator";
import type { PriceProvider } from "./types";

export const fallbackProvider: PriceProvider = {
  name: "fallback-generated",
  async getDailyPrices(symbol, limit) {
    return generateMockOHLCV(symbol, limit);
  },
};
