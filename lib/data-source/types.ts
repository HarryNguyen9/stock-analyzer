import type { OHLCV, StockSymbol } from "../../types/stock";

export type PriceProvider = {
  name: string;
  getDailyPrices(symbol: StockSymbol, limit: number): Promise<OHLCV[]>;
};

export type PriceFetchError = {
  symbol: StockSymbol;
  provider: string;
  reason: "not-configured" | "request-error";
  message: string;
  at: string;
  usedFallback: boolean;
  keptExistingFile: boolean;
};
