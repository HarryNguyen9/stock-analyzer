import { vi } from "@/lib/i18n/vi";
import { sortSignalsByPriority } from "@/lib/signals";
import type { Signal, SignalSentiment } from "@/lib/technical-analysis/types";
import type { StockSummary } from "@/types/stock";

export type ScannerGroupId =
  | "highScore"
  | "breakout"
  | "volumeSpike"
  | "oversoldRsi"
  | "strongTrend"
  | "riskWarning";

export type ScannerItem = {
  stock: StockSummary;
  signal: Signal | null;
  sortSignalPriority: number;
  sortVolumeSpike: number;
  sortLiquidity: number;
};

export type ScannerGroup = {
  id: ScannerGroupId;
  title: string;
  items: ScannerItem[];
};

export const SCANNER_MAX_ITEMS_PER_GROUP = 5;
export const SCANNER_MIN_AVG_VOLUME20 = 500_000;
export const SCANNER_MIN_TRADED_VALUE20 = 10_000_000_000;

export type ScannerDiagnostics = {
  filteredLowLiquidityCount: number;
  minAvgVolume20: number;
  minTradedValue20: number;
  groupsCounts: Record<ScannerGroupId, number>;
};

export function getScannerGroups(stocks: StockSummary[]): ScannerGroup[] {
  const readyStocks = stocks.filter((stock) => stock.dataStatus === "ready");
  const quality = getScannerQualityThresholds();
  const configs: Array<{
    id: ScannerGroupId;
    title: string;
    pickSignal: (stock: StockSummary) => Signal | null;
    include: (stock: StockSummary, signal: Signal | null) => boolean;
  }> = [
    {
      id: "highScore",
      title: vi.home.scannerGroups.highScore,
      pickSignal: (stock) => sortSignalsByPriority(stock.scannerSignals ?? [])[0] ?? null,
      include: (stock) => stock.score >= 70,
    },
    {
      id: "breakout",
      title: vi.home.scannerGroups.breakout,
      pickSignal: (stock) => findSignal(stock, (signal) => signal.category === "breakout"),
      include: (_, signal) => Boolean(signal),
    },
    {
      id: "volumeSpike",
      title: vi.home.scannerGroups.volumeSpike,
      pickSignal: (stock) =>
        findSignal(stock, (signal) => signal.category === "volume" && signal.sentiment === "bullish"),
      include: (_, signal) => Boolean(signal),
    },
    {
      id: "oversoldRsi",
      title: vi.home.scannerGroups.oversoldRsi,
      pickSignal: (stock) => findSignal(stock, (signal) => signal.code === "RSI_OVERSOLD"),
      include: (_, signal) => Boolean(signal),
    },
    {
      id: "strongTrend",
      title: vi.home.scannerGroups.strongTrend,
      pickSignal: (stock) =>
        findSignal(stock, (signal) => signal.code === "TREND_UP_MA20_MA50" || signal.code === "GOLDEN_CROSS"),
      include: (_, signal) => Boolean(signal),
    },
    {
      id: "riskWarning",
      title: vi.home.scannerGroups.riskWarning,
      pickSignal: (stock) => findSignal(stock, (signal) => signal.category === "risk" || signal.sentiment === "bearish"),
      include: (_, signal) => Boolean(signal),
    },
  ];

  let filteredLowLiquidityCount = 0;
  const groups = configs.map((config) => ({
    id: config.id,
    title: config.title,
    items: readyStocks
      .map((stock) => {
        const signal = config.pickSignal(stock);
        return {
          stock,
          signal,
          sortSignalPriority: signal?.priority ?? 0,
          sortVolumeSpike: getVolumeSortValue(stock),
          sortLiquidity: getLiquiditySortValue(stock),
        };
      })
      .filter((item) => {
        if (!config.include(item.stock, item.signal)) {
          return false;
        }

        if (!passesScannerQuality(item.stock, quality)) {
          filteredLowLiquidityCount += 1;
          return false;
        }

        return true;
      })
      .sort(sortScannerItems)
      .slice(0, SCANNER_MAX_ITEMS_PER_GROUP),
  }));

  attachScannerDiagnostics(groups, {
    filteredLowLiquidityCount,
    minAvgVolume20: quality.minAvgVolume20,
    minTradedValue20: quality.minTradedValue20,
    groupsCounts: getGroupsCounts(groups),
  });

  return groups;
}

export function getScoreSentiment(score: number): SignalSentiment {
  if (score >= 70) return "bullish";
  if (score < 45) return "bearish";
  return "neutral";
}

function sortScannerItems(a: ScannerItem, b: ScannerItem): number {
  return (
    (b.stock.avgTradedValue20 ?? 0) - (a.stock.avgTradedValue20 ?? 0) ||
    (b.stock.avgVolume20 ?? 0) - (a.stock.avgVolume20 ?? 0) ||
    b.sortSignalPriority - a.sortSignalPriority ||
    b.stock.score - a.stock.score ||
    b.sortVolumeSpike - a.sortVolumeSpike ||
    b.sortLiquidity - a.sortLiquidity
  );
}

function findSignal(stock: StockSummary, predicate: (signal: Signal) => boolean): Signal | null {
  return sortSignalsByPriority(stock.scannerSignals ?? []).find(predicate) ?? null;
}

function getVolumeSortValue(stock: StockSummary): number {
  const volumeSignal = findSignal(stock, (signal) => signal.category === "volume");
  return volumeSignal ? volumeSignal.priority + volumeSignal.strength : 0;
}

function getLiquiditySortValue(stock: StockSummary): number {
  const tradedValue = stock.avgTradedValue20 ?? 0;
  const volume = stock.avgVolume20 ?? 0;
  const exchangeBoost = stock.exchange === "HOSE" ? 15 : stock.exchange === "HNX" ? 8 : 0;
  const rankBoost = typeof stock.liquidityRank === "number" ? Math.max(0, 80 - stock.liquidityRank / 4) : 0;

  return Math.log10(Math.max(1, tradedValue)) * 12 + Math.log10(Math.max(1, volume)) * 4 + exchangeBoost + rankBoost;
}

export function passesScannerQuality(
  stock: StockSummary,
  quality: { minAvgVolume20: number; minTradedValue20: number } = getScannerQualityThresholds(),
): boolean {
  const avgVolume20 = stock.avgVolume20 ?? 0;
  const avgTradedValue20 = stock.avgTradedValue20 ?? 0;

  if (avgVolume20 >= quality.minAvgVolume20 || avgTradedValue20 >= quality.minTradedValue20) {
    return true;
  }

  return false;
}

export function getScannerQualityThresholds(): { minAvgVolume20: number; minTradedValue20: number } {
  return {
    minAvgVolume20: getEnvNumber("SCANNER_MIN_AVG_VOLUME20", SCANNER_MIN_AVG_VOLUME20),
    minTradedValue20: getEnvNumber("SCANNER_MIN_TRADED_VALUE20", SCANNER_MIN_TRADED_VALUE20),
  };
}

export function filterScannerGroupsByQuality(groups: ScannerGroup[]): ScannerGroup[] {
  const quality = getScannerQualityThresholds();

  return groups.map((group) => ({
    ...group,
    items: group.items
      .filter((item) => passesScannerQuality(item.stock, quality))
      .sort(sortScannerItems)
      .slice(0, SCANNER_MAX_ITEMS_PER_GROUP),
  }));
}

export function getScannerDiagnostics(groups: ScannerGroup[]): ScannerDiagnostics | null {
  const maybeDiagnostics = (groups as ScannerGroup[] & { diagnostics?: ScannerDiagnostics }).diagnostics;
  return maybeDiagnostics ?? null;
}

function attachScannerDiagnostics(groups: ScannerGroup[], diagnostics: ScannerDiagnostics) {
  Object.defineProperty(groups, "diagnostics", {
    value: diagnostics,
    enumerable: false,
  });
}

function getGroupsCounts(groups: ScannerGroup[]): Record<ScannerGroupId, number> {
  return groups.reduce(
    (counts, group) => ({
      ...counts,
      [group.id]: group.items.length,
    }),
    {
      highScore: 0,
      breakout: 0,
      volumeSpike: 0,
      oversoldRsi: 0,
      strongTrend: 0,
      riskWarning: 0,
    } satisfies Record<ScannerGroupId, number>,
  );
}

function getEnvNumber(key: string, fallback: number): number {
  const value = process.env[key];
  const parsed = value ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
