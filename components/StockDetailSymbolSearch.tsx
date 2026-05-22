"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { StockSummary } from "@/types/stock";

const SEARCH_LIMIT = 8;
const SEARCH_MIN_LENGTH = 2;
const DEBOUNCE_MS = 250;

type SearchState = {
  status: "idle" | "loading" | "ready" | "error";
  stocks: StockSummary[];
  message: string | null;
};

type SearchResponse = {
  ok: boolean;
  stocks?: StockSummary[];
  message?: string;
};

export function StockDetailSymbolSearch({ currentSymbol }: { currentSymbol: string }) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({
    status: "idle",
    stocks: [],
    message: null,
  });
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const normalizedQuery = useMemo(() => query.trim().toUpperCase(), [query]);
  const canSearch = normalizedQuery.length >= SEARCH_MIN_LENGTH;
  const showPanel = query.length > 0;

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setQuery("");
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setState({ status: "idle", stocks: [], message: null });
      return;
    }

    if (!canSearch) {
      setState({
        status: "ready",
        stocks: [],
        message: `Nhập ít nhất ${SEARCH_MIN_LENGTH} ký tự để tìm mã.`,
      });
      return;
    }

    const controller = new AbortController();
    const debounceId = window.setTimeout(async () => {
      setState({ status: "loading", stocks: [], message: null });

      try {
        const response = await fetch(
          `/api/symbols/search?q=${encodeURIComponent(normalizedQuery)}&limit=${SEARCH_LIMIT}`,
          { signal: controller.signal },
        );
        const payload = (await response.json()) as SearchResponse;

        if (!response.ok || !payload.ok) {
          throw new Error(payload.message ?? "Không thể tìm mã cổ phiếu.");
        }

        const stocks = (payload.stocks ?? []).filter((stock) => stock.symbol !== currentSymbol);
        setState({
          status: "ready",
          stocks,
          message: stocks.length > 0 ? null : "Không tìm thấy mã phù hợp.",
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setState({
          status: "error",
          stocks: [],
          message: error instanceof Error ? error.message : "Không thể tìm mã cổ phiếu.",
        });
      }
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(debounceId);
      controller.abort();
    };
  }, [canSearch, currentSymbol, normalizedQuery, query]);

  return (
    <div
      ref={wrapperRef}
      className="relative mt-4 rounded-2xl border border-sky-200 bg-white p-3 shadow-[0_14px_40px_rgba(15,23,42,0.06)] dark:border-cyan-300/10 dark:bg-[#071a31]/80 dark:shadow-[0_14px_40px_rgba(0,0,0,0.16)]"
    >
      <label htmlFor="stock-detail-symbol-search" className="mb-2 block text-xs font-semibold text-slate-500 dark:text-slate-400">
        Chuyển nhanh sang mã khác
      </label>
      <div className="flex min-h-12 items-center rounded-xl border border-sky-200 bg-slate-50 px-3 focus-within:border-cyan-400 focus-within:shadow-[0_0_24px_rgba(14,165,233,0.12)] dark:border-cyan-400/20 dark:bg-[#0b172b] dark:focus-within:border-cyan-300/70">
        <SearchIcon />
        <input
          id="stock-detail-symbol-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nhập mã, tên công ty hoặc sàn"
          className="min-h-12 min-w-0 flex-1 bg-transparent px-3 text-sm font-medium text-slate-950 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="rounded-full px-2 py-1 text-xs font-semibold text-slate-500 transition hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
          >
            Xóa
          </button>
        ) : null}
      </div>

      {showPanel ? (
        <div className="absolute left-3 right-3 top-[calc(100%-0.5rem)] z-30 overflow-hidden rounded-2xl border border-sky-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.18)] dark:border-cyan-300/15 dark:bg-[#061225] dark:shadow-[0_18px_60px_rgba(0,0,0,0.36)]">
          {state.status === "loading" ? (
            <div className="space-y-2 p-3">
              <div className="h-12 animate-pulse rounded-xl bg-slate-100 dark:bg-white/5" />
              <div className="h-12 animate-pulse rounded-xl bg-slate-100 dark:bg-white/5" />
            </div>
          ) : state.stocks.length > 0 ? (
            <div className="max-h-80 overflow-y-auto p-2">
              {state.stocks.map((stock) => (
                <Link
                  key={stock.symbol}
                  href={`/stock/${stock.symbol}`}
                  prefetch={false}
                  className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition hover:bg-sky-50 dark:hover:bg-cyan-300/10"
                  onClick={() => setQuery("")}
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
            <p className="p-4 text-sm text-slate-500 dark:text-slate-400">{state.message}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-300" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m21 21-4.3-4.3m1.3-5.2a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
