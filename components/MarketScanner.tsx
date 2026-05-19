import Link from "next/link";
import { formatTechnicalScore } from "@/lib/ai/score-format";
import { vi } from "@/lib/i18n/vi";
import {
  getScannerDiagnostics,
  getScannerGroups,
  getScoreSentiment,
  type ScannerGroup,
  type ScannerItem,
} from "@/lib/scanner/groups";
import type { SignalSentiment } from "@/lib/technical-analysis/types";
import type { StockSummary } from "@/types/stock";

export function MarketScanner({ stocks, snapshotGroups }: { stocks: StockSummary[]; snapshotGroups?: ScannerGroup[] | null }) {
  const sourceGroups = snapshotGroups ?? getScannerGroups(stocks);
  const diagnostics = snapshotGroups ? null : getScannerDiagnostics(sourceGroups);
  const groups = sourceGroups.filter((group) => group.items.length > 0);

  if (diagnostics) {
    console.info("market scanner quality diagnostics", diagnostics);
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 sm:p-5">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{vi.home.scannerTitle}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{vi.home.scannerSubtitle}</p>
          </div>
          <span className="hidden rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400 sm:inline-flex">
            {groups.reduce((total, group) => total + group.items.length, 0)} mã
          </span>
        </div>

        {groups.length > 0 ? (
          <div className="space-y-6">
            {groups.map((group) => (
              <section key={group.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/45">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{group.title}</h3>
                  <span className="text-xs font-medium text-slate-400 dark:text-slate-500">{group.items.length}</span>
                </div>
                <div className="-mx-3 flex snap-x gap-3 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
                  {group.items.map((item) => (
                    <ScannerCard key={`${group.id}-${item.stock.symbol}`} item={item} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-400">
            Chưa có đủ tín hiệu chất lượng cao.
          </div>
        )}
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
      className="w-64 shrink-0 snap-start rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
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
          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{formatTechnicalScore(item.stock.score)}</p>
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

function getSentimentClass(sentiment: SignalSentiment): string {
  if (sentiment === "bullish") return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  if (sentiment === "bearish") return "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300";
  return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
}
