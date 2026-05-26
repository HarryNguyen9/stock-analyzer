"use client";

import { useEffect, useRef, useState } from "react";
import { vi } from "@/lib/i18n/vi";
import type { DataFreshnessResult } from "@/lib/data-source/provider";

type SyncState = "idle" | "triggering" | "waiting" | "updated" | "timeout" | "error";
type ThemeMode = "light" | "dark" | "system";

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
const THEME_STORAGE_KEY = "stock-analyzer-theme";
const THEME_MODES: ThemeMode[] = ["light", "dark", "system"];

export function DataStatusPanel({
  initialFreshness,
}: {
  initialFreshness: DataFreshnessResult;
}) {
  const [freshness, setFreshness] = useState(initialFreshness);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const baselineUpdatedAt = useRef(initialFreshness.updatedAt);
  const triggeredAt = useRef<number | null>(null);
  const freshnessView = getFreshnessView(freshness);
  const isWaiting = syncState === "triggering" || syncState === "waiting";
  const isCoolingDown = Boolean(cooldownUntil && Date.now() < cooldownUntil);
  const isDisabled = isWaiting || isCoolingDown;

  useEffect(() => {
    const stored = readStoredTheme();
    setThemeMode(stored);
    applyTheme(stored);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readStoredTheme() === "system") {
        applyTheme("system");
      }
    };

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!settingsOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [settingsOpen]);

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

  function selectTheme(nextMode: ThemeMode) {
    localStorage.setItem(THEME_STORAGE_KEY, nextMode);
    setThemeMode(nextMode);
    applyTheme(nextMode);
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
          {freshness.status === "empty" ? (
            <p className="mt-1 text-sm font-medium text-cyan-700 dark:text-cyan-300">Vào cài đặt để tải lại dữ liệu.</p>
          ) : null}
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
          onClick={() => setSettingsOpen(true)}
          aria-label="Mở cài đặt"
          className="grid h-12 w-12 place-items-center rounded-2xl border border-sky-200 bg-white text-cyan-700 shadow-[0_14px_40px_rgba(15,23,42,0.08)] transition hover:border-cyan-300 hover:bg-sky-50 dark:border-cyan-400/20 dark:bg-[#0b1b31] dark:text-cyan-200 dark:shadow-[0_14px_40px_rgba(2,8,23,0.16)] dark:hover:border-cyan-300/40 dark:hover:bg-[#10223b]"
        >
          <SettingsIcon />
        </button>
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

      {settingsOpen ? (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/45 px-4 py-5 backdrop-blur-sm sm:items-center">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Đóng cài đặt"
            onClick={() => setSettingsOpen(false)}
          />
          <div className="relative w-full max-w-sm rounded-3xl border border-sky-200 bg-white p-4 text-slate-950 shadow-[0_24px_80px_rgba(15,23,42,0.24)] dark:border-cyan-400/20 dark:bg-[#07172b] dark:text-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-300">Cài đặt</p>
                <h2 className="mt-1 text-xl font-black">Dữ liệu & giao diện</h2>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:border-cyan-400/15 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
                aria-label="Đóng"
              >
                ×
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <button
                type="button"
                onClick={() => triggerSync()}
                disabled={isDisabled}
                className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-cyan-300/30 bg-cyan-50 px-4 text-sm font-bold text-slate-950 transition hover:border-cyan-400 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-cyan-400/10 dark:text-cyan-100 dark:hover:bg-cyan-400/15"
              >
                <span className="inline-flex items-center gap-3">
                  <RefreshIcon spinning={isWaiting} />
                  {isWaiting ? vi.home.manualSync.loading : vi.home.manualSync.label}
                </span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{freshnessView.statusText}</span>
              </button>

              <div className="grid grid-cols-3 gap-2">
                {THEME_MODES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => selectTheme(item)}
                    className={`flex min-h-16 flex-col items-center justify-center gap-2 rounded-2xl border text-xs font-bold transition ${
                      themeMode === item
                        ? "border-cyan-400 bg-cyan-50 text-cyan-700 shadow-[0_0_24px_rgba(14,165,233,0.14)] dark:bg-cyan-400/10 dark:text-cyan-200"
                        : "border-slate-200 bg-slate-50 text-slate-500 hover:border-cyan-300 hover:text-slate-900 dark:border-cyan-400/10 dark:bg-white/5 dark:text-slate-400 dark:hover:text-white"
                    }`}
                    aria-label={vi.theme[item]}
                  >
                    <ThemeIcon mode={item} />
                    {vi.theme[item]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
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
    synced: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-300",
    intraday: "border-cyan-300 bg-cyan-50 text-cyan-700 dark:border-cyan-400/25 dark:bg-cyan-400/10 dark:text-cyan-300",
    stale: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-300",
    "market-closed": "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-500/25 dark:bg-slate-500/15 dark:text-slate-300",
    empty: "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-500/25 dark:bg-slate-500/15 dark:text-slate-300",
    "local-fallback": "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-400/25 dark:bg-sky-400/10 dark:text-sky-300",
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

function readStoredTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "system";
  }

  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

function applyTheme(mode: ThemeMode) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const shouldUseDark = mode === "dark" || (mode === "system" && prefersDark);

  document.documentElement.classList.toggle("dark", shouldUseDark);
  document.documentElement.style.colorScheme = shouldUseDark ? "dark" : "light";
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 3v3" strokeLinecap="round" />
      <path d="M12 18v3" strokeLinecap="round" />
      <path d="M3 12h3" strokeLinecap="round" />
      <path d="M18 12h3" strokeLinecap="round" />
      <path d="m5.6 5.6 2.1 2.1" strokeLinecap="round" />
      <path d="m16.3 16.3 2.1 2.1" strokeLinecap="round" />
      <path d="m18.4 5.6-2.1 2.1" strokeLinecap="round" />
      <path d="m7.7 16.3-2.1 2.1" strokeLinecap="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function RefreshIcon({ spinning = false }: { spinning?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-5 w-5 text-cyan-600 dark:text-cyan-300 ${spinning ? "animate-spin" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 0 1-15 6.7" />
      <path d="M3 12a9 9 0 0 1 15-6.7" />
      <path d="M6 19H3v-3" />
      <path d="M18 5h3v3" />
    </svg>
  );
}

function ThemeIcon({ mode }: { mode: ThemeMode }) {
  if (mode === "light") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M12 3v2" />
        <path d="M12 19v2" />
        <path d="m4.22 4.22 1.42 1.42" />
        <path d="m18.36 18.36 1.42 1.42" />
        <path d="M3 12h2" />
        <path d="M19 12h2" />
        <path d="m4.22 19.78 1.42-1.42" />
        <path d="m18.36 5.64 1.42-1.42" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    );
  }

  if (mode === "dark") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5 7 7 0 1 0 20.5 14.5Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8" />
      <path d="M12 16v4" />
    </svg>
  );
}
