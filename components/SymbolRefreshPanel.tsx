"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SymbolFreshness } from "@/lib/data-source/symbol-freshness";
import { vi } from "@/lib/i18n/vi";

type RefreshState = "idle" | "refreshing" | "success" | "error";

type RefreshResponse =
  | {
      ok: true;
      symbol: string;
      refreshed: boolean;
      dataDateChanged?: boolean;
      latestDateBefore?: string | null;
      latestDateAfter?: string | null;
      durationMs: number;
    }
  | {
      ok: false;
      symbol: string | null;
      message: string;
      durationMs: number;
    };

export function SymbolRefreshPanel({
  symbol,
  freshness,
}: {
  symbol: string;
  freshness: SymbolFreshness;
}) {
  const router = useRouter();
  const [state, setState] = useState<RefreshState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (freshness.stale) {
      void refreshSymbol("auto");
    }
  }, [freshness.stale, symbol]);

  async function refreshSymbol(trigger: "auto" | "manual") {
    if (state === "refreshing") {
      return;
    }

    setState("refreshing");
    setMessage(trigger === "auto" ? vi.stock.refresh.updating : null);

    try {
      const response = await fetch(`/api/symbols/${encodeURIComponent(symbol)}/refresh`, {
        method: "POST",
      });
      const payload = (await response.json()) as RefreshResponse;

      if (!payload.ok) {
        throw new Error(payload.message);
      }

      setState("success");
      setMessage(getRefreshSuccessMessage(payload));
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : vi.stock.refresh.error);
    }
  }

  const shouldShowBanner = freshness.stale || state !== "idle";

  return (
    <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-950 dark:text-white">{vi.stock.refresh.title}</p>
          {shouldShowBanner ? (
            <p className={`mt-1 text-sm leading-5 ${state === "error" ? "text-amber-700 dark:text-amber-300" : "text-slate-500 dark:text-slate-400"}`}>
              {state === "refreshing" ? vi.stock.refresh.updating : message ?? getFreshnessText(freshness)}
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {freshness.lastUpdated ? vi.stock.refresh.fresh : vi.stock.refresh.noRecentSync}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => refreshSymbol("manual")}
          disabled={state === "refreshing"}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {state === "refreshing" ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
          {state === "refreshing" ? vi.stock.refresh.refreshing : vi.stock.refresh.button}
        </button>
      </div>
    </div>
  );
}

function getRefreshSuccessMessage(payload: Extract<RefreshResponse, { ok: true }>): string {
  if (!payload.refreshed) {
    return vi.stock.refresh.cooldown;
  }

  if (payload.dataDateChanged === false) {
    return vi.stock.refresh.noNewCandle;
  }

  return vi.stock.refresh.success;
}

function getFreshnessText(freshness: SymbolFreshness): string {
  if (freshness.reason === "never-synced") {
    return vi.stock.refresh.noRecentSync;
  }

  return vi.stock.refresh.stale;
}
