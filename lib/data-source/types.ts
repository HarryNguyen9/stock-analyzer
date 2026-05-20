import type { OHLCV } from "../../types/stock";

export type PriceProvider = {
  name: string;
  getDailyPrices(symbol: string, limit?: number): Promise<OHLCV[]>;
  fetchLatestQuote?(symbol: string): Promise<unknown>;
  fetchIntradayTrades?(symbol: string): Promise<unknown[]>;
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
