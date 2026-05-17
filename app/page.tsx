import { MarketScanner } from "@/components/MarketScanner";
import { NotificationCenter } from "@/components/NotificationCenter";
import { StockSearchList } from "@/components/StockSearchList";
import { ThemeToggle } from "@/components/ThemeToggle";
import { vi } from "@/lib/i18n/vi";
import { getDataFreshness, getStockSummaries } from "@/lib/data-source/prices";
import type { DataFreshnessResult } from "@/lib/data-source/provider";

export default async function Home() {
  const [stocks, dataFreshness] = await Promise.all([getStockSummaries(), getDataFreshness()]);
  const averageScore =
    stocks.length > 0
      ? Math.round(stocks.reduce((total, stock) => total + stock.score, 0) / stocks.length)
      : 0;
  const positiveCount = stocks.filter((stock) => stock.dayChangePercent >= 0).length;
  const hasDataError = stocks.some((stock) => stock.dataStatus === "error");
  const freshnessView = getFreshnessView(dataFreshness);

  return (
    <main className="min-h-screen">
      <section className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900 sm:max-w-md">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{vi.home.dataFreshnessTitle}</p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-950 dark:text-slate-100">
                  {freshnessView.timeText}
                  {dataFreshness.updatedAt ? (
                    <span className="ml-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                      {vi.home.dataTimezone}
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="ml-3 flex items-center">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${freshnessView.statusClass}`}
                >
                  {freshnessView.statusText}
                </span>
              </div>
            </div>
            <ThemeToggle />
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

      <MarketScanner stocks={stocks} />
      <StockSearchList stocks={stocks} hasDataError={hasDataError} />
      <NotificationCenter stocks={stocks} />
    </main>
  );
}

function getFreshnessView(dataFreshness: DataFreshnessResult) {
  const statusTextByStatus = {
    synced: vi.home.dataSynced,
    stale: vi.home.dataStale,
    "market-closed": vi.home.dataMarketClosed,
    empty: vi.home.dataEmpty,
    "local-fallback": vi.home.dataLocalFallback,
  } satisfies Record<DataFreshnessResult["status"], string>;

  const statusClassByStatus = {
    synced: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    stale: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    "market-closed": "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    empty: "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    "local-fallback": "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  } satisfies Record<DataFreshnessResult["status"], string>;

  return {
    statusText: statusTextByStatus[dataFreshness.status],
    statusClass: statusClassByStatus[dataFreshness.status],
    timeText: dataFreshness.updatedAt
      ? formatVietnamDateTime(dataFreshness.updatedAt)
      : statusTextByStatus[dataFreshness.status],
  };
}

function formatVietnamDateTime(value: string): string {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return vi.home.dataEmpty;
  }

  const parts = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour12: false,
  }).formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${getPart("hour")}:${getPart("minute")}, ${getPart("day")}/${getPart("month")}/${getPart("year")}`;
}
