import vnstock, { stock } from "vnstock-js";
import { DEFAULT_HISTORICAL_CANDLE_LIMIT } from "@/lib/data-source/constants";
import { classifyProviderFailure } from "@/lib/data-source/provider-errors";
import type { OHLCV } from "../../types/stock";
import type { PriceProvider } from "./types";

const MAX_RETRIES = 2;

// Adapter dữ liệu thật cho OHLCV daily của cổ phiếu Việt Nam.
// Nguồn hiện tại: package `vnstock-js`, hàm `stock.quote`, dùng VietCap REST API
// theo README của package và không cần Supabase/API key trong app này.
// Nếu sau này đổi vendor, chỉ cần thay implementation của `fetchDailyOhlcv`.
export const vnstockProvider: PriceProvider = {
  name: "vnstock",
  async getDailyPrices(symbol, limit = DEFAULT_HISTORICAL_CANDLE_LIMIT) {
    return withRetry(() => fetchDailyOhlcv(symbol, limit), MAX_RETRIES);
  },
  async fetchLatestQuote(symbol) {
    return withRetry(() => fetchLatestQuote(symbol), MAX_RETRIES);
  },
  async fetchIntradayTrades(symbol) {
    return withRetry(() => fetchIntradayTrades(symbol), MAX_RETRIES);
  },
};

export async function fetchDailyOhlcv(symbol: string, limit = DEFAULT_HISTORICAL_CANDLE_LIMIT): Promise<OHLCV[]> {
  const start = getLookbackStartDate(limit);
  const rows = await stock.quote({ ticker: symbol, start });
  const candles = rows.map(normalizeCandle).filter((item): item is OHLCV => item !== null);

  if (candles.length < 2) {
    throw new Error(`Dữ liệu ${symbol} không đủ nến hợp lệ từ vnstock-js`);
  }

  return candles.sort((a, b) => a.date.localeCompare(b.date)).slice(-limit);
}

export type LatestQuote = {
  symbol: string;
  lastPrice: number;
  changePercent: number | null;
  volume: number;
  open: number | null;
  high: number | null;
  low: number | null;
  updatedAt: string | null;
  source: "vnstock_price_board";
};

export type IntradayTrade = {
  time: string | null;
  price: number;
  volume: number;
  open?: number | null;
  high?: number | null;
  low?: number | null;
};

export async function fetchLatestQuote(symbol: string): Promise<LatestQuote | null> {
  const rows = await stock.priceBoard({ ticker: symbol });
  const row = rows.find((item) => item.symbol?.toUpperCase() === symbol.toUpperCase()) ?? rows[0];

  if (!row) {
    return null;
  }

  const lastPrice = toFiniteNumber(row.price);
  const referencePrice = toFiniteNumber(row.referencePrice);
  const volume = toFiniteNumber(row.totalVolume) ?? toFiniteNumber(row.matchVolume) ?? 0;
  const high = toFiniteNumber(row.highestPrice);
  const low = toFiniteNumber(row.lowestPrice);

  if (!lastPrice || lastPrice <= 0 || volume <= 0) {
    return null;
  }

  return {
    symbol: row.symbol?.toUpperCase() ?? symbol.toUpperCase(),
    lastPrice,
    changePercent: referencePrice && referencePrice > 0 ? ((lastPrice - referencePrice) / referencePrice) * 100 : null,
    volume,
    open: null,
    high,
    low,
    updatedAt: new Date().toISOString(),
    source: "vnstock_price_board",
  };
}

export async function fetchIntradayTrades(symbol: string): Promise<IntradayTrade[]> {
  const today = getVietnamTradingDate();
  const rows = await vnstock.stock.quote.history({
    symbols: [symbol],
    start: today,
    end: today,
    timeFrame: "1m",
  });

  return rows
    .map((row) => ({
      time: typeof row.date === "string" ? row.date : null,
      price: toFiniteNumber(row.close) ?? 0,
      volume: toFiniteNumber(row.volume) ?? 0,
      open: toFiniteNumber(row.open),
      high: toFiniteNumber(row.high),
      low: toFiniteNumber(row.low),
    }))
    .filter((row) => row.price > 0 && row.volume >= 0);
}

export function buildIntradayDailyCandle(
  symbol: string,
  input: { quote?: LatestQuote | null; trades?: IntradayTrade[] },
): OHLCV | null {
  const date = getVietnamTradingDate();
  const trades = input.trades ?? [];

  if (trades.length > 0) {
    const prices = trades.map((trade) => trade.price).filter((price) => Number.isFinite(price) && price > 0);

    if (prices.length > 0) {
      const first = trades[0];
      const highs = trades.map((trade) => trade.high ?? trade.price).filter((price) => Number.isFinite(price) && price > 0);
      const lows = trades.map((trade) => trade.low ?? trade.price).filter((price) => Number.isFinite(price) && price > 0);

      return {
        date,
        open: first.open && first.open > 0 ? first.open : prices[0],
        high: Math.max(...highs),
        low: Math.min(...lows),
        close: prices[prices.length - 1],
        volume: Math.round(trades.reduce((total, trade) => total + Math.max(0, trade.volume), 0)),
        isIntraday: true,
        finalized: false,
        source: "vnstock_intraday",
        updatedAt: new Date().toISOString(),
      };
    }
  }

  const quote = input.quote;

  if (!quote || quote.lastPrice <= 0 || quote.volume <= 0) {
    return null;
  }

  const open = quote.open ?? quote.lastPrice;
  const high = Math.max(quote.high ?? quote.lastPrice, open, quote.lastPrice);
  const low = Math.min(quote.low ?? quote.lastPrice, open, quote.lastPrice);

  return {
    date,
    open,
    high,
    low,
    close: quote.lastPrice,
    volume: Math.round(quote.volume),
    isIntraday: true,
    finalized: false,
    source: "vnstock_intraday",
    updatedAt: quote.updatedAt,
  };
}

async function withRetry<T>(operation: () => Promise<T>, retries: number): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (classifyProviderFailure(error).kind === "unsupported") {
        throw error;
      }

      if (attempt < retries) {
        await delay(800 * (attempt + 1));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function normalizeCandle(row: OHLCV): OHLCV | null {
  if (
    typeof row.date !== "string" ||
    !Number.isFinite(row.open) ||
    !Number.isFinite(row.high) ||
    !Number.isFinite(row.low) ||
    !Number.isFinite(row.close) ||
    !Number.isFinite(row.volume)
  ) {
    return null;
  }

  return {
    date: row.date.slice(0, 10),
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume,
  };
}

function getLookbackStartDate(limit: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - Math.max(420, limit * 3));
  return date.toISOString().slice(0, 10);
}

function getVietnamTradingDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function toFiniteNumber(value: unknown): number | null {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
