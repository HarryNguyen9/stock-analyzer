import { stock } from "vnstock-js";
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

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
