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
};

export type ScannerGroup = {
  id: ScannerGroupId;
  title: string;
  items: ScannerItem[];
};

const MAX_ITEMS = 5;

export function getScannerGroups(stocks: StockSummary[]): ScannerGroup[] {
  const readyStocks = stocks.filter((stock) => stock.dataStatus === "ready");
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

  return configs.map((config) => ({
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
        };
      })
      .filter((item) => config.include(item.stock, item.signal))
      .sort(sortScannerItems)
      .slice(0, MAX_ITEMS),
  }));
}

export function getScoreSentiment(score: number): SignalSentiment {
  if (score >= 70) return "bullish";
  if (score < 45) return "bearish";
  return "neutral";
}

function sortScannerItems(a: ScannerItem, b: ScannerItem): number {
  return (
    b.sortSignalPriority - a.sortSignalPriority ||
    b.stock.score - a.stock.score ||
    b.sortVolumeSpike - a.sortVolumeSpike
  );
}

function findSignal(stock: StockSummary, predicate: (signal: Signal) => boolean): Signal | null {
  return sortSignalsByPriority(stock.scannerSignals ?? []).find(predicate) ?? null;
}

function getVolumeSortValue(stock: StockSummary): number {
  const volumeSignal = findSignal(stock, (signal) => signal.category === "volume");
  return volumeSignal ? volumeSignal.priority + volumeSignal.strength : 0;
}
