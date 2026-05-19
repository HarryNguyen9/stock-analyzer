"use client";

import { useMemo, useState } from "react";
import { StockCard } from "@/components/StockCard";
import { vi } from "@/lib/i18n/vi";
import { passesScannerQuality } from "@/lib/scanner/groups";
import { sortSignalsByPriority } from "@/lib/signals";
import type { StockSummary } from "@/types/stock";

const FEATURED_LIMIT = 20;

export function StockSearchList({
  stocks,
  hasDataError,
}: {
  stocks: StockSummary[];
  hasDataError: boolean;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = normalizeSearch(query);
  const isSearching = normalizedQuery.length > 0;
  const displayStocks = useMemo(() => {
    if (!normalizedQuery) {
      return getFeaturedStocks(stocks);
    }

    return stocks.filter((stock) =>
      [stock.symbol, stock.name, stock.exchange, stock.sector]
        .map(normalizeSearch)
        .some((value) => value.includes(normalizedQuery)),
    );
  }, [normalizedQuery, stocks]);

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="sticky top-0 z-30 left-1/2 w-screen -translate-x-1/2 border-b border-slate-200 bg-slate-50/95 px-4 pb-4 pt-2 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90 sm:static sm:w-auto sm:translate-x-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-0 sm:dark:bg-transparent">
        <label htmlFor="stock-search" className="text-sm font-semibold text-slate-950 dark:text-white">
          {vi.home.searchLabel}
        </label>
        <div className="mt-2 flex min-h-12 items-center rounded-lg border border-slate-200 bg-white px-3 shadow-sm focus-within:border-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:focus-within:border-slate-600">
          <input
            id="stock-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={vi.home.searchPlaceholder}
            className="min-h-12 flex-1 bg-transparent text-base text-slate-950 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="ml-2 rounded-md px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              {vi.home.searchClear}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mb-4 mt-5 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
          {isSearching ? vi.home.searchResultTitle : vi.home.featuredSymbols}
        </h2>
        <div className="text-right">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            {vi.home.searchResults(displayStocks.length)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {hasDataError ? vi.home.dataError : vi.home.marketData}
          </p>
        </div>
      </div>

      {displayStocks.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {displayStocks.map((stock) => (
            <StockCard key={stock.symbol} stock={stock} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900">
          <p className="text-base font-semibold text-slate-950 dark:text-white">{vi.home.searchEmptyTitle}</p>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{vi.home.searchEmptyDescription}</p>
        </div>
      )}
    </section>
  );
}

function getFeaturedStocks(stocks: StockSummary[]): StockSummary[] {
  const qualityStocks = stocks.filter((stock) => stock.dataStatus === "ready" && passesScannerQuality(stock));
  const sourceStocks = qualityStocks.length > 0 ? qualityStocks : stocks;

  return [...sourceStocks]
    .sort((a, b) => getFeaturedScore(b) - getFeaturedScore(a))
    .slice(0, FEATURED_LIMIT);
}

function getFeaturedScore(stock: StockSummary): number {
  const signals = sortSignalsByPriority(stock.scannerSignals ?? []);
  const topSignal = signals[0];
  const hasBreakout = signals.some((signal) => signal.category === "breakout");
  const volumeSignal = signals.find((signal) => signal.category === "volume");
  const liquidityScore =
    Math.log10(Math.max(1, stock.avgTradedValue20 ?? 0)) * 8 +
    Math.log10(Math.max(1, stock.avgVolume20 ?? 0)) * 3;
  const liquidityBoost =
    stock.tier === "A"
      ? 18
      : stock.tier === "B"
        ? 8
        : 0;
  const rankBoost =
    typeof stock.liquidityRank === "number"
      ? Math.max(0, 30 - Math.min(30, stock.liquidityRank / 5))
      : 0;

  return (
    stock.score * 1.2 +
    (topSignal?.priority ?? 0) * 0.7 +
    (hasBreakout ? 18 : 0) +
    (volumeSignal ? volumeSignal.priority / 4 + volumeSignal.strength * 2 : 0) +
    liquidityScore +
    liquidityBoost +
    rankBoost
  );
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
