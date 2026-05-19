"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { CoveredWarrantWithMetrics } from "@/lib/cw/types";

const defaultUnderlying = "FPT";
const quickUnderlyings = ["FPT", "HPG", "STB"];

type LoadState = {
  status: "idle" | "loading" | "ready" | "error";
  message: string | null;
  warrants: CoveredWarrantWithMetrics[];
  source: "supabase" | "sample" | null;
};

type SearchPayload = {
  ok: boolean;
  message?: string;
  underlying?: string;
  warrants?: CoveredWarrantWithMetrics[];
  source?: "supabase" | "sample";
  updatedAt?: string | null;
};

export function CoveredWarrantsPanel({ active }: { active: boolean }) {
  const [query, setQuery] = useState(defaultUnderlying);
  const [submittedUnderlying, setSubmittedUnderlying] = useState(defaultUnderlying);
  const [state, setState] = useState<LoadState>({
    status: "idle",
    message: null,
    warrants: [],
    source: null,
  });

  useEffect(() => {
    if (!active) return;

    const controller = new AbortController();
    let cancelled = false;

    async function loadCoveredWarrants() {
      setState((current) => ({ ...current, status: "loading", message: null }));

      try {
        const response = await fetch(`/api/covered-warrants/search?underlying=${encodeURIComponent(submittedUnderlying)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as SearchPayload;

        if (!response.ok || !payload.ok) {
          throw new Error(payload.message ?? "Không tải được dữ liệu chứng quyền.");
        }

        if (!cancelled) {
          setState({
            status: "ready",
            message: null,
            warrants: payload.warrants ?? [],
            source: payload.source ?? null,
          });
        }
      } catch (error) {
        if (!cancelled && !(error instanceof Error && error.name === "AbortError")) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "Không tải được dữ liệu chứng quyền.",
            warrants: [],
            source: null,
          });
        }
      }
    }

    void loadCoveredWarrants();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [active, submittedUnderlying]);

  const summary = useMemo(() => buildCoveredWarrantSummary(state.warrants), [state.warrants]);

  function submitSearch(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const normalized = normalizeUnderlying(query);
    if (normalized) {
      setQuery(normalized);
      setSubmittedUnderlying(normalized);
    }
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-normal text-emerald-700 dark:text-emerald-400">
              Covered Warrants
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">So sánh chứng quyền</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
              Tìm theo mã cơ sở để xem các chứng quyền active, premium, hòa vốn, đòn bẩy và thanh khoản.
            </p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100 sm:max-w-sm">
            Chứng quyền có rủi ro cao, dữ liệu chỉ mang tính tham khảo, không phải khuyến nghị mua/bán.
          </div>
        </div>

        <form onSubmit={submitSearch} className="mt-5 flex flex-col gap-3 sm:flex-row">
          <div className="flex min-h-12 flex-1 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 focus-within:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:focus-within:border-slate-600">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value.toUpperCase())}
              placeholder="Nhập mã cơ sở, ví dụ FPT"
              className="min-h-12 flex-1 bg-transparent text-base font-semibold uppercase text-slate-950 outline-none placeholder:font-normal placeholder:normal-case placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
            />
          </div>
          <button
            type="submit"
            className="min-h-12 rounded-lg bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          >
            Tìm chứng quyền
          </button>
        </form>

        <div className="mt-3 flex flex-wrap gap-2">
          {quickUnderlyings.map((symbol) => (
            <button
              key={symbol}
              type="button"
              onClick={() => {
                setQuery(symbol);
                setSubmittedUnderlying(symbol);
              }}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                submittedUnderlying === symbol
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                  : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-950 dark:border-slate-800 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              {symbol}
            </button>
          ))}
        </div>
      </div>

      {state.status === "loading" || state.status === "idle" ? (
        <CoveredWarrantSkeleton />
      ) : state.status === "error" ? (
        <CoveredWarrantState title="Không tải được chứng quyền" description={state.message ?? "Vui lòng thử lại sau."} />
      ) : state.warrants.length === 0 ? (
        <CoveredWarrantState title={`Không tìm thấy chứng quyền active cho ${submittedUnderlying}`} description="Bạn có thể thử mã cơ sở khác hoặc chờ khi dữ liệu CW được đồng bộ từ provider thật." />
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="CW active" value={state.warrants.length.toString()} helper={state.source === "sample" ? "Dữ liệu mẫu" : "Supabase"} />
            <SummaryCard label="Thanh khoản tốt nhất" value={summary.bestLiquidity?.symbol ?? "-"} helper={formatVolume(summary.bestLiquidity?.volume ?? null)} />
            <SummaryCard label="Premium thấp nhất" value={summary.lowestPremium?.symbol ?? "-"} helper={formatPercent(summary.lowestPremium?.metrics.premiumPercent)} />
            <SummaryCard label="Đáo hạn gần" value={summary.nearMaturityRisk?.symbol ?? "-"} helper={summary.nearMaturityRisk ? `${summary.nearMaturityRisk.metrics.daysToMaturity} ngày` : "-"} />
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <h3 className="text-base font-semibold text-slate-950 dark:text-white">
                Chứng quyền active theo {submittedUnderlying}
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Sắp xếp theo thanh khoản, ngày đáo hạn và premium.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                  <tr>
                    <TableHead>Mã CW</TableHead>
                    <TableHead>Tổ chức phát hành</TableHead>
                    <TableHead>Giá thực hiện</TableHead>
                    <TableHead>Đáo hạn</TableHead>
                    <TableHead>Còn lại</TableHead>
                    <TableHead>Giá CW</TableHead>
                    <TableHead>Hòa vốn</TableHead>
                    <TableHead>Premium</TableHead>
                    <TableHead>Đòn bẩy</TableHead>
                    <TableHead>Spread</TableHead>
                    <TableHead>Thanh khoản</TableHead>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {state.warrants.map((warrant) => (
                    <tr key={warrant.symbol} className="hover:bg-slate-50 dark:hover:bg-slate-950/70">
                      <TableCell>
                        <span className="font-semibold text-slate-950 dark:text-white">{warrant.symbol}</span>
                        <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                          {warrant.type}
                        </span>
                      </TableCell>
                      <TableCell>{warrant.issuer}</TableCell>
                      <TableCell>{formatPrice(warrant.strikePrice)}</TableCell>
                      <TableCell>{formatDate(warrant.maturityDate)}</TableCell>
                      <TableCell>{warrant.metrics.daysToMaturity} ngày</TableCell>
                      <TableCell>{formatPrice(warrant.lastPrice)}</TableCell>
                      <TableCell>{formatPrice(warrant.metrics.breakEvenPrice)}</TableCell>
                      <TableCell>{formatPercent(warrant.metrics.premiumPercent)}</TableCell>
                      <TableCell>{formatMultiplier(warrant.metrics.effectiveLeverage)}</TableCell>
                      <TableCell>{formatPercent(warrant.metrics.spreadPercent)}</TableCell>
                      <TableCell>{formatVolume(warrant.volume)}</TableCell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function buildCoveredWarrantSummary(warrants: CoveredWarrantWithMetrics[]) {
  return {
    bestLiquidity: [...warrants].sort((a, b) => b.volume - a.volume)[0] ?? null,
    lowestPremium: [...warrants]
      .filter((warrant) => warrant.metrics.premiumPercent !== null)
      .sort((a, b) => (a.metrics.premiumPercent ?? 0) - (b.metrics.premiumPercent ?? 0))[0] ?? null,
    nearMaturityRisk: [...warrants].sort((a, b) => a.metrics.daysToMaturity - b.metrics.daysToMaturity)[0] ?? null,
  };
}

function SummaryCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{helper}</p>
    </div>
  );
}

function CoveredWarrantSkeleton() {
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-28 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
      ))}
    </div>
  );
}

function CoveredWarrantState({ title, description }: { title: string; description: string }) {
  return (
    <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900">
      <p className="text-base font-semibold text-slate-950 dark:text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
    </div>
  );
}

function TableHead({ children }: { children: ReactNode }) {
  return <th className="whitespace-nowrap px-4 py-3 font-semibold">{children}</th>;
}

function TableCell({ children }: { children: ReactNode }) {
  return <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">{children}</td>;
}

function normalizeUnderlying(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function formatPrice(value: number | null): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : "-";
}

function formatPercent(value: number | null): string {
  return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(2)}%` : "-";
}

function formatMultiplier(value: number | null): string {
  return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(2)}x` : "-";
}

function formatVolume(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "-";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}
