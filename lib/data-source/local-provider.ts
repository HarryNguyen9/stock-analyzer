import { readFile } from "node:fs/promises";
import path from "node:path";
import { STOCKS } from "@/data/symbols";
import { fallbackProvider } from "@/lib/data-source/fallback-provider";
import { createTechnicalSnapshot } from "@/lib/data-source/technical-snapshot";
import { round } from "@/lib/indicators";
import { vi } from "@/lib/i18n/vi";
import type { AppDataProvider, PriceDataResult } from "@/lib/data-source/provider";
import type { OHLCV, StockMetadata, StockSummary } from "@/types/stock";

export const localDataProvider: AppDataProvider = {
  async getPrices(symbol, options) {
    const localPrices = await readLocalPrices(symbol);

    if (localPrices.status === "ready") {
      return {
        status: "ready",
        source: "local-json",
        data: localPrices.data,
      };
    }

    if (localPrices.status === "error") {
      return localPrices;
    }

    return {
      status: "ready",
      source: "generated-fallback",
      data: await fallbackProvider.getDailyPrices(symbol, options?.limit ?? 200),
    };
  },
  async getSummaries() {
    return Promise.all(
      STOCKS.map(async (stock) => {
        const result = await localDataProvider.getPrices(stock.symbol);
        return toStockSummary(stock, result);
      }),
    );
  },
};

export function toStockSummary(
  stock: StockMetadata,
  result: PriceDataResult,
): StockSummary {
  if (result.status === "error") {
    return {
      ...stock,
      lastClose: 0,
      dayChangePercent: 0,
      latestDate: vi.stock.notAvailable,
      latestVolume: 0,
      score: 0,
      status: vi.score.weak,
      signal: vi.stock.invalidDataTitle,
      dataStatus: "error",
      dataError: result.error,
    };
  }

  const data = result.data;
  const latest = data[data.length - 1];
  const previous = data[data.length - 2];
  const liquidity = getLiquiditySnapshot(data);
  const technical = createTechnicalSnapshot(data, null);

  return {
    ...stock,
    lastClose: latest.close,
    dayChangePercent: round(((latest.close - previous.close) / previous.close) * 100),
    latestDate: latest.date,
    latestVolume: latest.volume,
    avgVolume20: liquidity.avgVolume20,
    avgTradedValue20: liquidity.avgTradedValue20,
    score: technical.score,
    status: technical.status,
    signal: technical.signals[0]?.labelVi ?? vi.stock.notAvailable,
    topSignals: technical.signals.slice(0, 2),
    scannerSignals: technical.signals,
    dataStatus: "ready",
  };
}

function getLiquiditySnapshot(data: OHLCV[]): { avgVolume20: number; avgTradedValue20: number } {
  const candles = data.slice(-20);

  if (candles.length === 0) {
    return { avgVolume20: 0, avgTradedValue20: 0 };
  }

  const totalVolume = candles.reduce((total, candle) => total + candle.volume, 0);
  const totalTradedValue = candles.reduce((total, candle) => total + candle.close * 1000 * candle.volume, 0);

  return {
    avgVolume20: Math.round(totalVolume / candles.length),
    avgTradedValue20: Math.round(totalTradedValue / candles.length),
  };
}

async function readLocalPrices(
  symbol: string,
): Promise<{ status: "ready"; data: OHLCV[] } | { status: "missing" } | { status: "error"; source: "local-json"; data: []; error: string }> {
  const filePath = path.join(process.cwd(), "data", "prices", `${symbol}.json`);

  try {
    const fileContent = await readFile(filePath, "utf-8");
    const parsed: unknown = JSON.parse(fileContent);

    if (!isOHLCVArray(parsed)) {
      return {
        status: "error",
        source: "local-json",
        data: [],
        error: `${symbol}: file JSON thiếu nến hoặc sai định dạng OHLCV`,
      };
    }

    return { status: "ready", data: parsed };
  } catch (error) {
    if (isNodeFileNotFound(error)) {
      return { status: "missing" };
    }

    return {
      status: "error",
      source: "local-json",
      data: [],
      error: `${symbol}: không đọc được file JSON local`,
    };
  }
}

function isOHLCVArray(value: unknown): value is OHLCV[] {
  return Array.isArray(value) && value.length >= 50 && value.every(isOHLCV);
}

export function isOHLCV(item: unknown): item is OHLCV {
  return (
    isRecord(item) &&
    typeof item.date === "string" &&
    typeof item.open === "number" &&
    Number.isFinite(item.open) &&
    typeof item.high === "number" &&
    Number.isFinite(item.high) &&
    typeof item.low === "number" &&
    Number.isFinite(item.low) &&
    typeof item.close === "number" &&
    Number.isFinite(item.close) &&
    typeof item.volume === "number" &&
    Number.isFinite(item.volume)
  );
}

function isNodeFileNotFound(error: unknown): boolean {
  return isRecord(error) && error.code === "ENOENT";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
