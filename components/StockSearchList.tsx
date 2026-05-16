"use client";

import { useMemo, useState } from "react";
import { StockCard } from "@/components/StockCard";
import { vi } from "@/lib/i18n/vi";
import type { StockSummary } from "@/types/stock";

export function StockSearchList({
  stocks,
  hasDataError,
}: {
  stocks: StockSummary[];
  hasDataError: boolean;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = normalizeSearch(query);
  const filteredStocks = useMemo(() => {
    if (!normalizedQuery) {
      return stocks;
    }

    return stocks.filter((stock) =>
      [stock.symbol, stock.name, stock.exchange, stock.sector]
        .map(normalizeSearch)
        .some((value) => value.includes(normalizedQuery)),
    );
  }, [normalizedQuery, stocks]);

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="sticky top-0 z-10 -mx-4 border-b border-slate-200 bg-slate-50/95 px-4 pb-4 pt-2 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-0">
        <label htmlFor="stock-search" className="text-sm font-semibold text-slate-950">
          {vi.home.searchLabel}
        </label>
        <div className="mt-2 flex min-h-12 items-center rounded-lg border border-slate-200 bg-white px-3 shadow-sm focus-within:border-slate-400">
          <input
            id="stock-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={vi.home.searchPlaceholder}
            className="min-h-12 flex-1 bg-transparent text-base text-slate-950 outline-none placeholder:text-slate-400"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="ml-2 rounded-md px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-950"
            >
              {vi.home.searchClear}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mb-4 mt-5 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-slate-950">{vi.home.watchlist}</h2>
        <div className="text-right">
          <p className="text-sm font-medium text-slate-600">
            {vi.home.searchResults(filteredStocks.length)}
          </p>
          <p className="text-xs text-slate-500">
            {hasDataError ? vi.home.dataError : vi.home.localData}
          </p>
        </div>
      </div>

      {filteredStocks.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {filteredStocks.map((stock) => (
            <StockCard key={stock.symbol} stock={stock} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center">
          <p className="text-base font-semibold text-slate-950">{vi.home.searchEmptyTitle}</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">{vi.home.searchEmptyDescription}</p>
        </div>
      )}
    </section>
  );
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
