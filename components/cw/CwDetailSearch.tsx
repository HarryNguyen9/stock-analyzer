"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CoveredWarrantWithMetrics } from "@/lib/cw/types";
import { formatPercent, formatPrice, formatVolume } from "@/components/cw/CwDetailCards";

const SEARCH_LIMIT = 8;
const SEARCH_MIN_LENGTH = 2;
const DEBOUNCE_MS = 250;

type SearchState = {
  status: "idle" | "loading" | "ready" | "error";
  warrants: CoveredWarrantWithMetrics[];
  message: string | null;
};

type SearchResponse = {
  ok: boolean;
  warrants?: CoveredWarrantWithMetrics[];
  message?: string;
};

export function CwDetailSearch({ currentSymbol }: { currentSymbol: string }) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({
    status: "idle",
    warrants: [],
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
      setState({ status: "idle", warrants: [], message: null });
      return;
    }

    if (!canSearch) {
      setState({
        status: "ready",
        warrants: [],
        message: `Nhập ít nhất ${SEARCH_MIN_LENGTH} ký tự để tìm mã CW.`,
      });
      return;
    }

    const controller = new AbortController();
    const debounceId = window.setTimeout(async () => {
      setState({ status: "loading", warrants: [], message: null });

      try {
        const response = await fetch(
          `/api/cw/detail-search?q=${encodeURIComponent(normalizedQuery)}&limit=${SEARCH_LIMIT}`,
          { signal: controller.signal },
        );
        const payload = (await response.json()) as SearchResponse;

        if (!response.ok || !payload.ok) {
          throw new Error(payload.message ?? "Không thể tìm mã chứng quyền.");
        }

        const warrants = (payload.warrants ?? []).filter((warrant) => warrant.symbol !== currentSymbol);
        setState({
          status: "ready",
          warrants,
          message: warrants.length > 0 ? null : "Không tìm thấy mã chứng quyền phù hợp.",
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setState({
          status: "error",
          warrants: [],
          message: error instanceof Error ? error.message : "Không thể tìm mã chứng quyền.",
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
      className="relative rounded-xl border border-cyan-300/10 bg-[#071a31]/92 p-2 shadow-[0_10px_28px_rgba(0,0,0,0.18)]"
    >
      <label htmlFor="cw-detail-search" className="sr-only">
        Chuyển nhanh sang mã chứng quyền khác
      </label>
      <div className="flex min-h-10 items-center rounded-lg border border-cyan-400/20 bg-[#0b172b] px-3 focus-within:border-cyan-300/70 focus-within:shadow-[0_0_20px_rgba(34,211,238,0.12)]">
        <SearchIcon />
        <input
          id="cw-detail-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nhập mã CW hoặc mã cơ sở"
          className="min-h-10 min-w-0 flex-1 bg-transparent px-3 text-sm font-medium text-white outline-none placeholder:text-slate-500"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="rounded-full px-2 py-1 text-xs font-semibold text-slate-400 transition hover:text-white"
          >
            Xóa
          </button>
        ) : null}
      </div>

      {showPanel ? (
        <div className="absolute left-2 right-2 top-[calc(100%-0.25rem)] z-50 overflow-hidden rounded-2xl border border-cyan-300/15 bg-[#061225] shadow-[0_18px_60px_rgba(0,0,0,0.36)]">
          {state.status === "loading" ? (
            <div className="space-y-2 p-3">
              <div className="h-12 animate-pulse rounded-xl bg-white/5" />
              <div className="h-12 animate-pulse rounded-xl bg-white/5" />
            </div>
          ) : state.warrants.length > 0 ? (
            <div className="max-h-80 overflow-y-auto p-2">
              {state.warrants.map((warrant) => (
                <Link
                  key={warrant.symbol}
                  href={`/cw/${warrant.symbol}`}
                  prefetch={false}
                  className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition hover:bg-cyan-300/10"
                  onClick={() => setQuery("")}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-black text-white">{warrant.symbol}</p>
                      <span className="rounded-md border border-cyan-300/40 px-1.5 py-0.5 text-[10px] font-bold text-cyan-200">
                        {warrant.type ? warrant.type.toUpperCase() : "CW"}
                      </span>
                      <span className="rounded-md border border-emerald-300/30 px-1.5 py-0.5 text-[10px] font-bold text-emerald-200">
                        {warrant.underlyingSymbol}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">
                      {warrant.issuer ?? "Chưa có TCPH"} · Premium {formatPercent(warrant.metrics.premiumPercent)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-white">{formatPrice(warrant.lastPrice)}</p>
                    <p className="text-xs font-semibold text-cyan-300">{formatVolume(warrant.volume)}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="p-4 text-sm text-slate-400">{state.message}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-cyan-300" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m21 21-4.3-4.3m1.3-5.2a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
