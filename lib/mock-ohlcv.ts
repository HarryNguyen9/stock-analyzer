import { STOCKS } from "@/data/symbols";
import type { OHLCV, StockSymbol, StockSummary } from "@/types/stock";
import { analyzeTechnical } from "@/lib/analysis";
import { round } from "@/lib/indicators";
import { generateMockOHLCV } from "@/lib/data-source/mock-generator";
import { vi } from "@/lib/i18n/vi";

export function getMockOHLCV(symbol: StockSymbol, candles = 180): OHLCV[] {
  return generateMockOHLCV(symbol, candles);
}

export function getStockSummaries(): StockSummary[] {
  return STOCKS.map((stock) => {
    const data = getMockOHLCV(stock.symbol);
    const latest = data[data.length - 1];
    const previous = data[data.length - 2];
    const analysis = analyzeTechnical(data);

    return {
      ...stock,
      lastClose: latest.close,
      dayChangePercent: round(((latest.close - previous.close) / previous.close) * 100),
      latestDate: latest.date,
      latestVolume: latest.volume,
      score: analysis.score,
      status: getScoreStatus(analysis.score),
      signal: analysis.signals[0].label,
      dataStatus: "ready",
    };
  });
}

export function isStockSymbol(value: string): value is StockSymbol {
  return STOCKS.some((stock) => stock.symbol === value);
}

// Future data boundary: replace this function with a Supabase query or market-data API fetch.
// Keep callers using OHLCV[] so real historical prices can drop in without UI rewrites.
export async function getHistoricalPrices(symbol: StockSymbol): Promise<OHLCV[]> {
  return getMockOHLCV(symbol);
}

function getScoreStatus(score: number): StockSummary["status"] {
  if (score >= 70) return vi.score.constructive;
  if (score >= 45) return vi.score.neutral;
  return vi.score.weak;
}
