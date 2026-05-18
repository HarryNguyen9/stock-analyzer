import { DataStatusPanel } from "@/components/DataStatusPanel";
import { MarketScanner } from "@/components/MarketScanner";
import { NotificationCenter } from "@/components/NotificationCenter";
import { StockSearchList } from "@/components/StockSearchList";
import { ThemeToggle } from "@/components/ThemeToggle";
import { vi } from "@/lib/i18n/vi";
import { getDataFreshness, getStockSummaries } from "@/lib/data-source/prices";
import { readHomeScannerSnapshot } from "@/lib/scanner/snapshot";

export default async function Home() {
  const [stocks, dataFreshness] = await Promise.all([
    getStockSummaries(),
    getDataFreshness(),
  ]);
  const mergedScannerSnapshot = await readHomeScannerSnapshot(stocks);
  const averageScore =
    stocks.length > 0
      ? Math.round(stocks.reduce((total, stock) => total + stock.score, 0) / stocks.length)
      : 0;
  const positiveCount = stocks.filter((stock) => stock.dayChangePercent >= 0).length;
  const hasDataError = stocks.some((stock) => stock.dataStatus === "error");

  return (
    <main className="min-h-screen">
      <section className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <DataStatusPanel initialFreshness={dataFreshness} />
            <div className="flex items-start justify-between gap-3 sm:flex-col sm:items-end">
              <ThemeToggle />
            </div>
          </div>

          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-normal text-emerald-700 dark:text-emerald-400">
                {vi.home.eyebrow}
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-normal text-slate-950 dark:text-white sm:text-5xl">
                {vi.home.title}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-400">
                {vi.home.description}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:w-80">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-sm text-slate-500 dark:text-slate-400">{vi.home.averageScore}</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">{averageScore}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-sm text-slate-500 dark:text-slate-400">{vi.home.greenToday}</p>
                <p className="mt-2 text-3xl font-semibold text-emerald-700 dark:text-emerald-400">
                  {positiveCount}/{stocks.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <MarketScanner stocks={stocks} snapshotGroups={mergedScannerSnapshot} />
      <StockSearchList stocks={stocks} hasDataError={hasDataError} />
      <NotificationCenter stocks={stocks} />
    </main>
  );
}
