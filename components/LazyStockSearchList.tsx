"use client";

import { useEffect, useState } from "react";
import { StockSearchList } from "@/components/StockSearchList";
import type { StockSummary } from "@/types/stock";

type SearchState =
  | { status: "idle"; stocks: StockSummary[]; message: null }
  | { status: "loading"; stocks: StockSummary[]; message: null }
  | { status: "ready"; stocks: StockSummary[]; message: null }
  | { status: "error"; stocks: StockSummary[]; message: string };

export function LazyStockSearchList({ active }: { active: boolean }) {
  const [state, setState] = useState<SearchState>({
    status: "idle",
    stocks: [],
    message: null,
  });

  useEffect(() => {
    if (!active || state.status !== "idle") {
      return;
    }

    let cancelled = false;

    async function loadStocks() {
      setState({ status: "loading", stocks: [], message: null });
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 12_000);

      try {
        const response = await fetch("/api/stocks/summaries", {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as {
          ok: boolean;
          stocks?: StockSummary[];
          message?: string;
          durationMs?: number;
        };

        if (!response.ok || !payload.ok) {
          throw new Error(payload.message ?? "Không tải được danh sách cổ phiếu.");
        }

        if (!cancelled) {
          console.info("stock search summaries loaded", {
            count: payload.stocks?.length ?? 0,
            durationMs: payload.durationMs ?? null,
          });
          setState({ status: "ready", stocks: payload.stocks ?? [], message: null });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            stocks: [],
            message: error instanceof Error && error.name === "AbortError"
              ? "Danh sách cổ phiếu tải quá lâu, vui lòng thử lại."
              : error instanceof Error ? error.message : "Không tải được danh sách cổ phiếu.",
          });
        }
      } finally {
        window.clearTimeout(timeoutId);
      }
    }

    void loadStocks();

    return () => {
      cancelled = true;
    };
  }, [active, state.status]);

  if (!active && state.status === "idle") {
    return null;
  }

  if (state.status === "loading" || state.status === "idle") {
    return <SearchSkeleton />;
  }

  if (state.status === "error") {
    return (
      <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <h2 className="text-lg font-semibold">Không thể tải danh sách cổ phiếu</h2>
          <p className="mt-2 text-sm leading-6 opacity-85">{state.message}</p>
          <button
            type="button"
            onClick={() => setState({ status: "idle", stocks: [], message: null })}
            className="mt-4 inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
          >
            Thử lại
          </button>
        </div>
      </section>
    );
  }

  return <StockSearchList stocks={state.stocks} hasDataError={state.stocks.some((stock) => stock.dataStatus === "error")} />;
}

function SearchSkeleton() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="animate-pulse rounded-lg bg-slate-200 h-20 dark:bg-slate-800" />
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-56 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
        ))}
      </div>
    </section>
  );
}
