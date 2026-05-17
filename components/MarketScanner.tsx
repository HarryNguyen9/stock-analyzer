import Link from "next/link";
import { vi } from "@/lib/i18n/vi";
import { sortSignalsByPriority } from "@/lib/signals";
import type { Signal, SignalSentiment } from "@/lib/technical-analysis/types";
import type { StockSummary } from "@/types/stock";

type ScannerGroupId =
  | "highScore"
  | "breakout"
  | "volumeSpike"
  | "oversoldRsi"
  | "strongTrend"
  | "riskWarning";

type ScannerItem = {
  stock: StockSummary;
  signal: Signal | null;
  sortSignalPriority: number;
  sortVolumeSpike: number;
};

const MAX_ITEMS = 5;

export function MarketScanner({ stocks }: { stocks: StockSummary[] }) {
  const groups = getScannerGroups(stocks).filter((group) => group.items.length > 0);

  if (groups.length === 0) {
    return null;
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{vi.home.scannerTitle}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{vi.home.scannerSubtitle}</p>
        </div>
      </div>

      <div className="space-y-5">
        {groups.map((group) => (
          <section key={group.id}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{group.title}</h3>
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500">{group.items.length}</span>
            </div>
            <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
              {group.items.map((item) => (
                <ScannerCard key={`${group.id}-${item.stock.symbol}`} item={item} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function ScannerCard({ item }: { item: ScannerItem }) {
  const isUp = item.stock.dayChangePercent >= 0;
  const sentiment = item.signal?.sentiment ?? getScoreSentiment(item.stock.score);

  return (
    <Link
      href={`/stock/${item.stock.symbol}`}
      className="w-64 shrink-0 snap-start rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-lg font-semibold text-slate-950 dark:text-white">{item.stock.symbol}</p>
            <span className="rounded border border-slate-200 px-1.5 py-0.5 text-[11px] font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {item.stock.exchange}
            </span>
          </div>
          <p className="mt-1 text-sm font-semibold tabular-nums text-slate-950 dark:text-slate-100">
            {item.stock.lastClose.toFixed(2)}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-sm font-semibold ${isUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
            {isUp ? "+" : ""}
            {item.stock.dayChangePercent.toFixed(2)}%
          </p>
          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{item.stock.score}/100</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="line-clamp-1 text-sm font-medium text-slate-700 dark:text-slate-300">
          {item.signal?.labelVi ?? item.stock.signal}
        </p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${getSentimentClass(sentiment)}`}>
          {vi.home.scannerSentiment[sentiment]}
        </span>
      </div>
    </Link>
  );
}

function getScannerGroups(stocks: StockSummary[]) {
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

function getScoreSentiment(score: number): SignalSentiment {
  if (score >= 70) return "bullish";
  if (score < 45) return "bearish";
  return "neutral";
}

function getSentimentClass(sentiment: SignalSentiment): string {
  if (sentiment === "bullish") return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  if (sentiment === "bearish") return "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300";
  return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
}
