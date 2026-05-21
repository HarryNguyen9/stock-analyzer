"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { vi } from "@/lib/i18n/vi";
import type { DataFreshnessResult } from "@/lib/data-source/provider";

type SyncState = "idle" | "triggering" | "waiting" | "updated" | "timeout" | "error";

type TriggerSyncResponse = {
  ok: boolean;
  message: string;
  triggeredAt?: string;
};

type DataStatusResponse = {
  ok: boolean;
  freshness?: DataFreshnessResult;
  message?: string;
};

const POLL_INTERVAL_MS = 20_000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;
const COOLDOWN_MS = 2 * 60 * 1000;

export function DataStatusPanel({
  initialFreshness,
  trailingAction,
}: {
  initialFreshness: DataFreshnessResult;
  trailingAction?: ReactNode;
}) {
  const [freshness, setFreshness] = useState(initialFreshness);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const baselineUpdatedAt = useRef(initialFreshness.updatedAt);
  const triggeredAt = useRef<number | null>(null);
  const freshnessView = getFreshnessView(freshness);
  const isWaiting = syncState === "triggering" || syncState === "waiting";
  const isCoolingDown = Boolean(cooldownUntil && Date.now() < cooldownUntil);
  const isDisabled = isWaiting || isCoolingDown;

  useEffect(() => {
    if (!cooldownUntil) {
      return;
    }

    const remainingMs = cooldownUntil - Date.now();

    if (remainingMs <= 0) {
      setCooldownUntil(null);
      return;
    }

    const timer = window.setTimeout(() => {
      setCooldownUntil(null);
    }, remainingMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [cooldownUntil]);

  useEffect(() => {
    if (syncState !== "waiting") {
      return;
    }

    const poll = async () => {
      const nextFreshness = await readDataStatus();

      if (!nextFreshness) {
        return;
      }

      setFreshness(nextFreshness);

      if (hasFreshDataChanged(baselineUpdatedAt.current, nextFreshness.updatedAt)) {
        setSyncState("updated");
        setMessage(vi.home.manualSync.updated);
        setCooldownUntil(Date.now() + COOLDOWN_MS);
        return;
      }

      if (triggeredAt.current && Date.now() - triggeredAt.current >= POLL_TIMEOUT_MS) {
        setSyncState("timeout");
        setMessage(vi.home.manualSync.timeout);
        setCooldownUntil(Date.now() + COOLDOWN_MS);
      }
    };

    const timer = window.setInterval(poll, POLL_INTERVAL_MS);
    void poll();

    return () => {
      window.clearInterval(timer);
    };
  }, [syncState]);

  async function triggerSync(adminSecret?: string) {
    setSyncState("triggering");
    setMessage(null);
    baselineUpdatedAt.current = freshness.updatedAt;

    try {
      const response = await fetch("/api/admin/trigger-sync", {
        method: "POST",
        headers: {
          ...(adminSecret ? { "x-admin-sync-secret": adminSecret } : {}),
        },
      });

      if (response.status === 401 && !adminSecret) {
        const secret = window.prompt(vi.home.manualSync.secretPrompt);

        if (secret) {
          await triggerSync(secret);
          return;
        }

        setSyncState("idle");
        setMessage(null);
        return;
      }

      const payload = (await response.json()) as TriggerSyncResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || vi.home.manualSync.error);
      }

      triggeredAt.current = Date.now();
      setSyncState("waiting");
      setMessage(vi.home.manualSync.waiting);
    } catch (error) {
      setSyncState("error");
      setMessage(error instanceof Error ? error.message : vi.home.manualSync.error);
      setCooldownUntil(Date.now() + COOLDOWN_MS);
    }
  }

  return (
    <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-start">
      <div className="flex w-full flex-wrap items-center rounded-2xl border border-sky-200 bg-white/90 px-4 py-4 shadow-[0_16px_48px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/[0.03] dark:border-cyan-400/15 dark:bg-[#0b1b31]/95 dark:shadow-[0_16px_48px_rgba(8,145,178,0.10)] dark:ring-white/5 sm:flex-nowrap sm:px-5 lg:max-w-3xl">
        <div className="mr-4 grid h-12 w-12 shrink-0 place-items-center rounded-full border border-cyan-400/20 bg-cyan-50 text-cyan-600 shadow-[0_0_34px_rgba(14,165,233,0.12)] dark:border-cyan-300/20 dark:bg-cyan-400/10 dark:text-cyan-300 dark:shadow-[0_0_34px_rgba(34,211,238,0.16)]">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 0 1-15 6.7" />
            <path d="M3 12a9 9 0 0 1 15-6.7" />
            <path d="M6 19H3v-3" />
            <path d="M18 5h3v3" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{vi.home.dataFreshnessTitle}</p>
          <p className="mt-1 text-base font-semibold tabular-nums text-slate-950 dark:text-white sm:text-xl">
            {freshnessView.timeText}
            {freshness.updatedAt ? (
              <span className="ml-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                {vi.home.dataTimezone}
              </span>
            ) : null}
          </p>
        </div>
        <div className="mt-3 flex w-full items-center pl-16 sm:ml-3 sm:mt-0 sm:w-auto sm:pl-0">
          <span className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${freshnessView.statusClass}`}>
            {getSyncStatusText(syncState, freshnessView.statusText)}
          </span>
        </div>
      </div>

      <div className="flex w-full flex-wrap items-center gap-3 lg:w-auto lg:justify-end">
        <button
          type="button"
          onClick={() => triggerSync()}
          disabled={isDisabled}
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-3 rounded-xl border border-sky-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-[0_14px_40px_rgba(15,23,42,0.08)] transition hover:border-cyan-300 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-cyan-400/15 dark:bg-[#0b1b31] dark:text-white dark:shadow-[0_14px_40px_rgba(2,8,23,0.16)] dark:hover:border-cyan-300/40 dark:hover:bg-[#10223b] sm:flex-none"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className={`h-5 w-5 text-cyan-300 ${isWaiting ? "animate-spin" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 0 1-15 6.7" />
            <path d="M3 12a9 9 0 0 1 15-6.7" />
            <path d="M6 19H3v-3" />
            <path d="M18 5h3v3" />
          </svg>
          {isWaiting ? vi.home.manualSync.loading : vi.home.manualSync.label}
        </button>
        {trailingAction ? <div className="shrink-0">{trailingAction}</div> : null}
        {message ? (
          <p
            className={`w-full text-xs leading-5 lg:max-w-xs ${
              syncState === "error" || syncState === "timeout"
                ? "text-amber-600 dark:text-amber-400"
                : "text-emerald-700 dark:text-emerald-400"
            }`}
          >
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}

async function readDataStatus(): Promise<DataFreshnessResult | null> {
  try {
    const response = await fetch("/api/data-status", { cache: "no-store" });
    const payload = (await response.json()) as DataStatusResponse;

    return response.ok && payload.ok && payload.freshness ? payload.freshness : null;
  } catch {
    return null;
  }
}

function hasFreshDataChanged(previous: string | null, next: string | null): boolean {
  if (!next) {
    return false;
  }

  return previous !== next;
}

function getSyncStatusText(syncState: SyncState, fallback: string): string {
  if (syncState === "triggering" || syncState === "waiting") {
    return vi.home.manualSync.sent;
  }

  if (syncState === "updated") {
    return vi.home.manualSync.updated;
  }

  return fallback;
}

function getFreshnessView(dataFreshness: DataFreshnessResult) {
  const statusTextByStatus = {
    synced: vi.home.dataSynced,
    intraday: vi.home.dataIntradayPending,
    stale: vi.home.dataStale,
    "market-closed": vi.home.dataMarketClosed,
    empty: vi.home.dataEmpty,
    "local-fallback": vi.home.dataLocalFallback,
  } satisfies Record<DataFreshnessResult["status"], string>;

  const statusClassByStatus = {
    synced: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
    intraday: "border-cyan-400/25 bg-cyan-400/10 text-cyan-300",
    stale: "border-amber-400/25 bg-amber-400/10 text-amber-300",
    "market-closed": "border-slate-500/25 bg-slate-500/15 text-slate-300",
    empty: "border-slate-500/25 bg-slate-500/15 text-slate-300",
    "local-fallback": "border-sky-400/25 bg-sky-400/10 text-sky-300",
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
