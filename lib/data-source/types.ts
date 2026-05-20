import type { OHLCV } from "../../types/stock";

export type PriceProvider = {
  name: string;
  getDailyPrices(symbol: string, limit?: number): Promise<OHLCV[]>;
};

export type PriceFetchError = {
  symbol: string;
  provider: string;
  reason: "not-configured" | "request-error";
  message: string;
  at: string;
  usedFallback: boolean;
  keptExistingFile: boolean;
};
