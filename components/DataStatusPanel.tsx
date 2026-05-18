"use client";

import { useEffect, useRef, useState } from "react";
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

export function DataStatusPanel({ initialFreshness }: { initialFreshness: DataFreshnessResult }) {
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
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="flex w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900 sm:max-w-md">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{vi.home.dataFreshnessTitle}</p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-950 dark:text-slate-100">
            {freshnessView.timeText}
            {freshness.updatedAt ? (
              <span className="ml-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                {vi.home.dataTimezone}
              </span>
            ) : null}
          </p>
        </div>
        <div className="ml-3 flex items-center">
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${freshnessView.statusClass}`}>
            {getSyncStatusText(syncState, freshnessView.statusText)}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-start gap-2 sm:items-end">
        <button
          type="button"
          onClick={() => triggerSync()}
          disabled={isDisabled}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-800"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className={`h-4 w-4 ${isWaiting ? "animate-spin" : ""}`}
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
        {message ? (
          <p
            className={`max-w-xs text-xs leading-5 ${
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
