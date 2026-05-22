"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { StockCard } from "@/components/StockCard";
import { vi } from "@/lib/i18n/vi";
import type { StockSummary } from "@/types/stock";

const FEATURED_LIMIT = 20;
const SEARCH_LIMIT = 30;
const COMPACT_SEARCH_LIMIT = 8;
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
  const [compactQuery, setCompactQuery] = useState("");
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
  const searchInputWrapRef = useRef<HTMLDivElement | null>(null);
  const compactSearchInputRef = useRef<HTMLInputElement | null>(null);
  const pendingCompactScrollYRef = useRef<number | null>(null);
  const [compactSearchVisible, setCompactSearchVisible] = useState(false);
  const normalizedQuery = useMemo(() => query.trim(), [query]);
  const hasQuery = normalizedQuery.length > 0;
  const canSearch = normalizedQuery.length >= SEARCH_MIN_LENGTH;
  const normalizedCompactQuery = useMemo(() => compactQuery.trim(), [compactQuery]);
  const compactHasQuery = normalizedCompactQuery.length > 0;
  const compactCanSearch = normalizedCompactQuery.length >= SEARCH_MIN_LENGTH;
  const [compactResults, setCompactResults] = useState<LoadState>({
    status: "idle",
    stocks: [],
    message: null,
  });
  const compactDisplayStatus = compactHasQuery && !compactCanSearch ? "ready" : compactResults.status;
  const compactDisplayMessage = compactHasQuery && !compactCanSearch
    ? `Nhập ít nhất ${SEARCH_MIN_LENGTH} ký tự để tìm nhanh hơn.`
    : compactResults.message;
  const displayStocks = hasQuery ? results.stocks : featured.stocks;
  const displayStatus = hasQuery && !canSearch ? "ready" : hasQuery ? results.status : featured.status;
  const displayMessage = hasQuery && !canSearch
    ? `Nhập ít nhất ${SEARCH_MIN_LENGTH} ký tự để tìm nhanh hơn.`
    : hasQuery
      ? results.message
      : featured.message;

  useEffect(() => {
    if (!active) {
      setCompactSearchVisible(false);
      resetSearchState();
      return;
    }

    function updateCompactVisibility() {
      const target = searchInputWrapRef.current;

      if (!target) {
        return;
      }

      const stickyTriggerTop = window.innerWidth >= 640 ? 120 : 112;
      const rect = target.getBoundingClientRect();
      const nextVisible = rect.bottom <= stickyTriggerTop + 8;
      setCompactSearchVisible((wasVisible) => {
        if (wasVisible && !nextVisible) {
          resetCompactSearchState();
        }
        return nextVisible;
      });
    }

    updateCompactVisibility();
    window.addEventListener("scroll", updateCompactVisibility, { passive: true });
    window.addEventListener("resize", updateCompactVisibility);

    return () => {
      window.removeEventListener("scroll", updateCompactVisibility);
      window.removeEventListener("resize", updateCompactVisibility);
    };
  }, [active]);

  useEffect(() => {
    const scrollY = pendingCompactScrollYRef.current;

    if (scrollY === null) {
      return;
    }

    pendingCompactScrollYRef.current = null;
    window.requestAnimationFrame(() => {
      window.scrollTo(window.scrollX, scrollY);
    });
  }, [compactQuery, compactDisplayStatus]);

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

  useEffect(() => {
    if (!active || !compactSearchVisible) {
      return;
    }

    if (normalizedCompactQuery.length === 0) {
      setCompactResults({ status: "idle", stocks: [], message: null });
      return;
    }

    if (!compactCanSearch) {
      setCompactResults({
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
        url: `/api/symbols/search?q=${encodeURIComponent(normalizedCompactQuery)}&limit=${COMPACT_SEARCH_LIMIT}`,
        controller,
        onStart: () => setCompactResults({ status: "loading", stocks: [], message: null }),
        onSuccess: (stocks) => {
          if (cancelled) return;
          setCompactResults({
            status: "ready",
            stocks,
            message: stocks.length > 0 ? null : "Không tìm thấy mã phù hợp.",
          });
        },
        onError: (message) => {
          if (!cancelled) setCompactResults({ status: "error", stocks: [], message });
        },
      });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(debounceId);
      controller.abort();
    };
  }, [active, compactCanSearch, compactSearchVisible, normalizedCompactQuery]);

  if (!active && featured.status === "idle") {
    return null;
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div
        className={`sticky top-[112px] z-30 -mx-1 h-0 overflow-visible transition-all duration-200 sm:top-[120px] ${
          compactSearchVisible ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
        }`}
        aria-hidden={!compactSearchVisible}
      >
        <div className="relative rounded-2xl border border-cyan-300/20 bg-white/95 p-2 shadow-[0_14px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:bg-[#071a31]/95 dark:shadow-[0_14px_40px_rgba(0,0,0,0.26)]">
          <div className="flex min-h-11 items-center rounded-xl border border-sky-200 bg-slate-50 px-3 focus-within:border-cyan-400 focus-within:shadow-[0_0_22px_rgba(14,165,233,0.12)] dark:border-cyan-400/25 dark:bg-[#10223b] dark:focus-within:border-cyan-300/70">
            <span className="mr-3 text-slate-400 dark:text-slate-500">
              <SearchIcon />
            </span>
            <input
              id="stock-search-compact"
              ref={compactSearchInputRef}
              type="search"
              value={compactQuery}
              onChange={(event) => updateCompactQuery(event.target.value)}
              placeholder={vi.home.searchPlaceholder}
              className="min-h-11 min-w-0 flex-1 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
            />
            {compactQuery ? (
              <button
                type="button"
                onClick={() => updateCompactQuery("")}
                className="ml-2 rounded-full border border-sky-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-cyan-300 hover:text-slate-950 dark:border-cyan-400/15 dark:text-slate-300 dark:hover:border-cyan-300/40 dark:hover:text-white"
              >
                {vi.home.searchClear}
              </button>
            ) : (
              <span className="ml-2 text-slate-500">
                <SlidersIcon />
              </span>
            )}
          </div>
          {compactHasQuery ? (
            <CompactSearchPanel
              stocks={compactResults.stocks}
              status={compactDisplayStatus}
              message={compactDisplayMessage}
              canSearch={compactCanSearch}
            />
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-sky-200 bg-white p-5 shadow-[0_20px_70px_rgba(15,23,42,0.10)] ring-1 ring-slate-900/[0.03] dark:border-cyan-400/15 dark:bg-[#0b1b31] dark:shadow-[0_20px_70px_rgba(2,8,23,0.24)] dark:ring-white/5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-emerald-300/30 bg-emerald-50 text-emerald-600 dark:border-emerald-300/25 dark:bg-emerald-400/10 dark:text-emerald-300">
              <SearchIcon />
            </span>
            <div>
              <h2 className="text-2xl font-semibold text-slate-950 dark:text-white">Tìm mã cổ phiếu</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">Tra cứu mã, tên công ty hoặc sàn giao dịch.</p>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{vi.home.searchResults(displayStocks.length)}</p>
            <p className="mt-1 text-sm text-emerald-600 dark:text-emerald-300">{vi.home.marketData}</p>
          </div>
        </div>

        <div
          ref={searchInputWrapRef}
          className="mt-5 flex min-h-14 items-center rounded-2xl border border-sky-200 bg-slate-50 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] focus-within:border-cyan-400 focus-within:shadow-[0_0_28px_rgba(14,165,233,0.12)] dark:border-cyan-400/25 dark:bg-[#10223b] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] dark:focus-within:border-cyan-300/70 dark:focus-within:shadow-[0_0_28px_rgba(34,211,238,0.14)]"
        >
          <span className="mr-3 text-slate-400 dark:text-slate-500">
            <SearchIcon />
          </span>
          <input
            id="stock-search"
            type="search"
            value={query}
            onChange={(event) => updateQuery(event.target.value, "full")}
            placeholder={vi.home.searchPlaceholder}
            className="min-h-14 min-w-0 flex-1 bg-transparent text-base text-slate-950 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
          />
          {query ? (
            <button
              type="button"
              onClick={() => updateQuery("", "full")}
              className="ml-2 rounded-full border border-sky-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-cyan-300 hover:text-slate-950 dark:border-cyan-400/15 dark:text-slate-300 dark:hover:border-cyan-300/40 dark:hover:text-white"
            >
              {vi.home.searchClear}
            </button>
          ) : (
            <span className="ml-2 text-slate-500">
              <SlidersIcon />
            </span>
          )}
        </div>

        {!hasQuery ? (
          <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-400">
            Nhập mã để tìm cổ phiếu hoặc xem các mã nổi bật bên dưới.
          </p>
        ) : null}
      </div>

      <div className="mt-8 flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-cyan-300/30 bg-cyan-50 text-cyan-600 dark:border-cyan-300/25 dark:bg-cyan-400/10 dark:text-cyan-300">
            <StarIcon />
          </span>
          <h2 className="truncate text-2xl font-semibold text-slate-950 dark:text-white">
            {hasQuery ? vi.home.searchResultTitle : vi.home.featuredSymbols}
          </h2>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{vi.home.searchResults(displayStocks.length)}</p>
          <p className="text-xs text-slate-500">{vi.home.marketData}</p>
        </div>
      </div>

      {displayStatus === "loading" || displayStatus === "idle" ? (
        <SearchSkeleton />
      ) : displayStatus === "error" ? (
        <SearchError message={displayMessage ?? "Không tải được danh sách, vui lòng thử lại"} onRetry={() => retryCurrentLoad(hasQuery)} />
      ) : displayStocks.length > 0 ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {displayStocks.map((stock, index) => (
            <StockCard key={getStockListKey(stock, index)} stock={stock} />
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

  function updateQuery(nextQuery: string, source: "full" | "compact") {
    if (source === "compact" && compactSearchVisible) {
      pendingCompactScrollYRef.current = window.scrollY;
    }

    setQuery(nextQuery);
  }

  function updateCompactQuery(nextQuery: string) {
    pendingCompactScrollYRef.current = window.scrollY;
    setCompactQuery(nextQuery);
  }

  function resetSearchState() {
    setQuery("");
    setResults({ status: "idle", stocks: [], message: null });
    resetCompactSearchState();
  }

  function resetCompactSearchState() {
    pendingCompactScrollYRef.current = null;
    setCompactQuery("");
    setCompactResults({ status: "idle", stocks: [], message: null });
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
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="h-56 animate-pulse rounded-2xl border border-sky-200 bg-white dark:border-cyan-400/10 dark:bg-[#0b1b31]" />
      ))}
    </div>
  );
}

function SearchError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900 dark:border-amber-300/20 dark:bg-amber-400/10 dark:text-amber-100">
      <h2 className="text-lg font-semibold">Không thể tải danh sách cổ phiếu</h2>
      <p className="mt-2 text-sm leading-6 opacity-85">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex min-h-10 items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950"
      >
        Thử lại
      </button>
    </div>
  );
}

function SearchEmpty({ message, isSearching }: { message: string | null; isSearching: boolean }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-sky-200 bg-white p-6 text-center text-slate-600 dark:border-cyan-400/15 dark:bg-[#0b1b31] dark:text-slate-300">
      <p className="text-base font-semibold text-slate-950 dark:text-white">{isSearching ? vi.home.searchEmptyTitle : "Chưa có mã nổi bật"}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
        {message ?? (isSearching ? vi.home.searchEmptyDescription : "Dữ liệu sẽ xuất hiện sau lần cập nhật snapshot tiếp theo.")}
      </p>
    </div>
  );
}

function CompactSearchPanel({
  stocks,
  status,
  message,
  canSearch,
}: {
  stocks: StockSummary[];
  status: "idle" | "loading" | "ready" | "error";
  message: string | null;
  canSearch: boolean;
}) {
  return (
    <div className="absolute left-2 right-2 top-[calc(100%-0.25rem)] z-50 overflow-hidden rounded-2xl border border-sky-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.18)] dark:border-cyan-300/15 dark:bg-[#061225] dark:shadow-[0_18px_60px_rgba(0,0,0,0.36)]">
      {!canSearch ? (
        <p className="p-4 text-sm text-slate-500 dark:text-slate-400">{message}</p>
      ) : status === "loading" || status === "idle" ? (
        <div className="space-y-2 p-3">
          <div className="h-12 animate-pulse rounded-xl bg-slate-100 dark:bg-white/5" />
          <div className="h-12 animate-pulse rounded-xl bg-slate-100 dark:bg-white/5" />
        </div>
      ) : status === "error" ? (
        <p className="p-4 text-sm text-amber-700 dark:text-amber-200">{message ?? "Không thể tải danh sách cổ phiếu."}</p>
      ) : stocks.length > 0 ? (
        <div className="max-h-80 overflow-y-auto p-2">
          {stocks.slice(0, 8).map((stock, index) => (
            <Link
              key={getStockListKey(stock, index)}
              href={`/stock/${stock.symbol}`}
              prefetch={false}
              className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition hover:bg-sky-50 dark:hover:bg-cyan-300/10"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-black text-slate-950 dark:text-white">{stock.symbol}</p>
                  <span className="rounded-md border border-cyan-300/40 px-1.5 py-0.5 text-[10px] font-bold text-cyan-700 dark:text-cyan-200">
                    {stock.exchange}
                  </span>
                </div>
                <p className="mt-0.5 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">{stock.name}</p>
              </div>
              <div className="shrink-0 text-right">
                {stock.dataStatus === "ready" ? (
                  <>
                    <p className="text-sm font-bold text-slate-950 dark:text-white">{stock.lastClose.toFixed(2)}</p>
                    <p className={stock.dayChangePercent >= 0 ? "text-xs font-semibold text-emerald-500" : "text-xs font-semibold text-rose-500"}>
                      {stock.dayChangePercent >= 0 ? "+" : ""}
                      {stock.dayChangePercent.toFixed(2)}%
                    </p>
                  </>
                ) : (
                  <p className="text-xs font-semibold text-slate-400">Chưa có giá</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="p-4 text-sm text-slate-500 dark:text-slate-400">{message ?? vi.home.searchEmptyDescription}</p>
      )}
    </div>
  );
}

function getStockListKey(stock: StockSummary, index: number) {
  return `${stock.symbol}-${stock.exchange}-${index}`;
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7h10" />
      <path d="M18 7h2" />
      <path d="M4 17h2" />
      <path d="M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />
    </svg>
  );
}
