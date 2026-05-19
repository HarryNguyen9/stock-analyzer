"use client";

import { useEffect, useMemo, useState } from "react";
import { StockCard } from "@/components/StockCard";
import { vi } from "@/lib/i18n/vi";
import type { StockSummary } from "@/types/stock";

const FEATURED_LIMIT = 20;
const SEARCH_LIMIT = 30;
const SEARCH_MIN_LENGTH = 2;
const REQUEST_TIMEOUT_MS = 8_000;

type LoadState = {
  status: "idle" | "loading" | "ready" | "error";
  stocks: StockSummary[];
  message: string | null;
};

type SearchResponse = {
  ok: boolean;
  stocks?: StockSummary[];
  message?: string;
  durationMs?: number;
  source?: string;
};

export function LazyStockSearchList({ active }: { active: boolean }) {
  const [query, setQuery] = useState("");
  const [featured, setFeatured] = useState<LoadState>({
    status: "idle",
    stocks: [],
    message: null,
  });
  const [results, setResults] = useState<LoadState>({
    status: "idle",
    stocks: [],
    message: null,
  });
  const [featuredRetryKey, setFeaturedRetryKey] = useState(0);
  const [retryKey, setRetryKey] = useState(0);
  const normalizedQuery = useMemo(() => query.trim(), [query]);
  const hasQuery = normalizedQuery.length > 0;
  const canSearch = normalizedQuery.length >= SEARCH_MIN_LENGTH;
  const displayStocks = hasQuery ? results.stocks : featured.stocks;
  const displayStatus = hasQuery && !canSearch ? "ready" : hasQuery ? results.status : featured.status;
  const displayMessage = hasQuery && !canSearch
    ? `Nhập ít nhất ${SEARCH_MIN_LENGTH} ký tự để tìm nhanh hơn.`
    : hasQuery
      ? results.message
      : featured.message;

  useEffect(() => {
    if (!active || featured.status !== "idle") {
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    void loadStocks({
      url: `/api/symbols/search?limit=${FEATURED_LIMIT}&featured=true`,
      controller,
      onStart: () => setFeatured({ status: "loading", stocks: [], message: null }),
      onSuccess: (stocks, payload) => {
        if (cancelled) return;
        console.info("featured symbols loaded", {
          count: stocks.length,
          durationMs: payload.durationMs ?? null,
          source: payload.source ?? null,
        });
        setFeatured({ status: "ready", stocks, message: null });
      },
      onError: (message) => {
        if (!cancelled) setFeatured({ status: "error", stocks: [], message });
      },
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [active, featuredRetryKey]);

  useEffect(() => {
    if (!active) {
      return;
    }

    if (normalizedQuery.length === 0) {
      setResults({ status: "idle", stocks: [], message: null });
      return;
    }

    if (!canSearch) {
      setResults({
        status: "ready",
        stocks: [],
        message: `Nhập ít nhất ${SEARCH_MIN_LENGTH} ký tự để tìm nhanh hơn.`,
      });
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    const debounceId = window.setTimeout(() => {
      void loadStocks({
        url: `/api/symbols/search?q=${encodeURIComponent(normalizedQuery)}&limit=${SEARCH_LIMIT}`,
        controller,
        onStart: () => setResults({ status: "loading", stocks: [], message: null }),
        onSuccess: (stocks, payload) => {
          if (cancelled) return;
          console.info("symbol search loaded", {
            query: normalizedQuery,
            count: stocks.length,
            durationMs: payload.durationMs ?? null,
          });
          setResults({ status: "ready", stocks, message: null });
        },
        onError: (message) => {
          if (!cancelled) setResults({ status: "error", stocks: [], message });
        },
      });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(debounceId);
      controller.abort();
    };
  }, [active, canSearch, normalizedQuery, retryKey]);

  if (!active && featured.status === "idle") {
    return null;
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="sticky top-[57px] z-30 -mx-4 border-b border-slate-200 bg-slate-50/95 px-4 pb-4 pt-2 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-0 sm:dark:bg-transparent">
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
          {hasQuery ? vi.home.searchResultTitle : vi.home.featuredSymbols}
        </h2>
        <div className="text-right">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            {vi.home.searchResults(displayStocks.length)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{vi.home.marketData}</p>
        </div>
      </div>

      {displayStatus === "loading" || displayStatus === "idle" ? (
        <SearchSkeleton />
      ) : displayStatus === "error" ? (
        <SearchError message={displayMessage ?? "Không tải được danh sách, vui lòng thử lại"} onRetry={() => retryCurrentLoad(hasQuery)} />
      ) : displayStocks.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {displayStocks.map((stock) => (
            <StockCard key={stock.symbol} stock={stock} />
          ))}
        </div>
      ) : (
        <SearchEmpty message={displayMessage} isSearching={hasQuery} />
      )}
    </section>
  );

  function retryCurrentLoad(searching: boolean) {
    if (searching) {
      setResults({ status: "idle", stocks: [], message: null });
      setRetryKey((current) => current + 1);
      return;
    }

    setFeatured({ status: "idle", stocks: [], message: null });
    setFeaturedRetryKey((current) => current + 1);
  }
}

async function loadStocks({
  url,
  controller,
  onStart,
  onSuccess,
  onError,
}: {
  url: string;
  controller: AbortController;
  onStart: () => void;
  onSuccess: (stocks: StockSummary[], payload: SearchResponse) => void;
  onError: (message: string) => void;
}) {
  onStart();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });
    const payload = (await response.json()) as SearchResponse;

    if (!response.ok || !payload.ok) {
      throw new Error(payload.message ?? "Không tải được danh sách, vui lòng thử lại");
    }

    onSuccess(payload.stocks ?? [], payload);
  } catch (error) {
    onError(
      error instanceof Error && error.name === "AbortError"
        ? "Không tải được danh sách, vui lòng thử lại"
        : error instanceof Error
          ? error.message
          : "Không tải được danh sách, vui lòng thử lại",
    );
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function SearchSkeleton() {
  return (
    <div>
      <div className="animate-pulse rounded-lg bg-slate-200 h-20 dark:bg-slate-800" />
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-56 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
        ))}
      </div>
    </div>
  );
}

function SearchError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
      <h2 className="text-lg font-semibold">Không tải được danh sách cổ phiếu</h2>
      <p className="mt-2 text-sm leading-6 opacity-85">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
      >
        Thử lại
      </button>
    </div>
  );
}

function SearchEmpty({ message, isSearching }: { message: string | null; isSearching: boolean }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900">
      <p className="text-base font-semibold text-slate-950 dark:text-white">
        {isSearching ? vi.home.searchEmptyTitle : "Chưa có mã nổi bật"}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
        {message ?? (isSearching ? vi.home.searchEmptyDescription : "Dữ liệu sẽ xuất hiện sau lần cập nhật snapshot tiếp theo.")}
      </p>
    </div>
  );
}
