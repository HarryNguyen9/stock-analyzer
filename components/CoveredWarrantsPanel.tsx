"use client";

import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { CoveredWarrantWithMetrics } from "@/lib/cw/types";

type LoadState = {
  status: "intro" | "loading" | "ready" | "error";
  message: string | null;
  warrants: CoveredWarrantWithMetrics[];
};

type SearchPayload = {
  ok: boolean;
  message?: string | null;
  warrants?: CoveredWarrantWithMetrics[];
};

type SortMode = "liquidity" | "premium" | "breakeven" | "low-price";
type PremiumFilter = "all" | "low" | "medium" | "high";

const premiumLowThreshold = 5;
const premiumHighThreshold = 20;
const strongVolumeThreshold = 100_000;
const weakVolumeThreshold = 10_000;
const lowPriceRiskThreshold = 0.1;

export function CoveredWarrantsPanel({ active }: { active: boolean }) {
  const [query, setQuery] = useState("");
  const [submittedUnderlying, setSubmittedUnderlying] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("liquidity");
  const [issuerFilter, setIssuerFilter] = useState("all");
  const [premiumFilter, setPremiumFilter] = useState<PremiumFilter>("all");
  const [minVolume, setMinVolume] = useState("");
  const [state, setState] = useState<LoadState>({
    status: "intro",
    message: "Nhập mã cơ sở để xem chứng quyền đang giao dịch.",
    warrants: [],
  });

  const issuers = useMemo(() => getIssuers(state.warrants), [state.warrants]);
  const displayWarrants = useMemo(
    () => sortWarrants(filterWarrants(state.warrants, issuerFilter, premiumFilter, minVolume), sortMode),
    [issuerFilter, minVolume, premiumFilter, sortMode, state.warrants],
  );
  const summary = useMemo(() => buildCoveredWarrantSummary(state.warrants), [state.warrants]);
  const dataSource = state.warrants.find((warrant) => warrant.source)?.source;

  async function submitSearch(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const normalized = normalizeUnderlying(query);

    if (!normalized) {
      setSubmittedUnderlying("");
      setState({
        status: "intro",
        message: "Nhập mã cơ sở để xem chứng quyền đang giao dịch.",
        warrants: [],
      });
      return;
    }

    setQuery(normalized);
    setSubmittedUnderlying(normalized);
    setState({ status: "loading", message: null, warrants: [] });

    try {
      const response = await fetch(`/api/cw/search?underlying=${encodeURIComponent(normalized)}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as SearchPayload;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message ?? "Không tải được dữ liệu chứng quyền.");
      }

      setState({
        status: "ready",
        message: payload.message ?? null,
        warrants: payload.warrants ?? [],
      });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Không tải được dữ liệu chứng quyền.",
        warrants: [],
      });
    }
  }

  if (!active) return null;

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
              Tìm theo mã cơ sở để xem chứng quyền active, premium, hòa vốn và thanh khoản.
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
      </div>

      {state.status === "intro" ? (
        <CoveredWarrantState title="Nhập mã cơ sở" description={state.message ?? "Nhập mã cơ sở để xem chứng quyền đang giao dịch."} />
      ) : state.status === "loading" ? (
        <CoveredWarrantSkeleton />
      ) : state.status === "error" ? (
        <CoveredWarrantState title="Không tải được chứng quyền" description={state.message ?? "Vui lòng thử lại sau."} />
      ) : state.warrants.length === 0 ? (
        <CoveredWarrantState
          title={submittedUnderlying ? `Không tìm thấy chứng quyền active cho ${submittedUnderlying}` : "Chưa có dữ liệu chứng quyền"}
          description={state.message ?? "Chưa có dữ liệu chứng quyền. Hãy chạy đồng bộ CW từ provider."}
        />
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <SummaryCard label="CW active" value={state.warrants.length.toString()} helper={submittedUnderlying} />
            <SummaryCard label="Thanh khoản tốt nhất" value={summary.bestLiquidity?.symbol ?? "-"} helper={formatVolume(summary.bestLiquidity?.volume ?? null)} />
            <SummaryCard label="Premium thấp nhất" value={summary.lowestPremium?.symbol ?? "-"} helper={formatPercent(summary.lowestPremium?.metrics.premiumPercent)} />
            <SummaryCard label="Hòa vốn thấp nhất" value={summary.lowestBreakEven?.symbol ?? "-"} helper={formatPrice(summary.lowestBreakEven?.metrics.breakEvenPrice ?? null)} />
            <SummaryCard label="Nguồn dữ liệu" value={formatSource(dataSource)} helper="Supabase" />
          </div>

          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            <p className="font-semibold">Lưu ý khi so sánh chứng quyền</p>
            <p className="mt-1">
              Premium thấp không đồng nghĩa an toàn. Cần xét thanh khoản, thời gian đáo hạn và biến động mã cơ sở.
              Dữ liệu chỉ mang tính tham khảo, không phải khuyến nghị mua/bán.
            </p>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="grid gap-3 md:grid-cols-4">
              <ControlField label="Sắp xếp">
                <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} className={controlClassName}>
                  <option value="liquidity">Thanh khoản cao nhất</option>
                  <option value="premium">Premium thấp nhất</option>
                  <option value="breakeven">Hòa vốn thấp nhất</option>
                  <option value="low-price">Giá thấp nhất</option>
                </select>
              </ControlField>
              <ControlField label="TCPH">
                <select value={issuerFilter} onChange={(event) => setIssuerFilter(event.target.value)} className={controlClassName}>
                  <option value="all">Tất cả</option>
                  {issuers.map((issuer) => (
                    <option key={issuer} value={issuer}>{issuer}</option>
                  ))}
                </select>
              </ControlField>
              <ControlField label="Premium">
                <select value={premiumFilter} onChange={(event) => setPremiumFilter(event.target.value as PremiumFilter)} className={controlClassName}>
                  <option value="all">Tất cả</option>
                  <option value="low">Thấp (&lt;= 5%)</option>
                  <option value="medium">Vừa (5-20%)</option>
                  <option value="high">Cao (&gt;= 20%)</option>
                </select>
              </ControlField>
              <ControlField label="Volume tối thiểu">
                <input
                  type="number"
                  min="0"
                  value={minVolume}
                  onChange={(event) => setMinVolume(event.target.value)}
                  placeholder="VD: 10000"
                  className={controlClassName}
                />
              </ControlField>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-950 dark:text-white">
                    Chứng quyền active theo {submittedUnderlying}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Hiển thị {displayWarrants.length}/{state.warrants.length} mã sau lọc.
                  </p>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Các cột thiếu dữ liệu từ list page đã được ẩn.</p>
              </div>
            </div>

            {displayWarrants.length === 0 ? (
              <div className="p-5 text-sm text-slate-500 dark:text-slate-400">Không có chứng quyền phù hợp bộ lọc hiện tại.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[860px] w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                    <tr>
                      <TableHead>Mã CW</TableHead>
                      <TableHead>TCPH</TableHead>
                      <TableHead>Giá CW</TableHead>
                      <TableHead>Giá cơ sở</TableHead>
                      <TableHead>Hòa vốn</TableHead>
                      <TableHead>Premium</TableHead>
                      <TableHead>Thanh khoản</TableHead>
                      <TableHead>Đánh giá</TableHead>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {displayWarrants.map((warrant) => (
                      <tr key={warrant.symbol} className="hover:bg-slate-50 dark:hover:bg-slate-950/70">
                        <TableCell>
                          <span className="font-semibold text-slate-950 dark:text-white">{warrant.symbol}</span>
                          {warrant.type ? (
                            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                              {warrant.type}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell>{warrant.issuer ?? "-"}</TableCell>
                        <TableCell>{formatPrice(warrant.lastPrice)}</TableCell>
                        <TableCell>{formatPrice(warrant.underlyingPrice)}</TableCell>
                        <TableCell>{formatPrice(warrant.metrics.breakEvenPrice)}</TableCell>
                        <TableCell>{formatPercent(warrant.metrics.premiumPercent)}</TableCell>
                        <TableCell>{formatVolume(warrant.volume)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1.5">
                            {getWarrantBadges(warrant).map((badge) => (
                              <span key={badge.label} className={`rounded-full px-2 py-1 text-[11px] font-semibold ${badge.className}`}>
                                {badge.label}
                              </span>
                            ))}
                          </div>
                        </TableCell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

const controlClassName =
  "min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:border-slate-600";

function ControlField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

function filterWarrants(
  warrants: CoveredWarrantWithMetrics[],
  issuerFilter: string,
  premiumFilter: PremiumFilter,
  minVolume: string,
): CoveredWarrantWithMetrics[] {
  const minimumVolume = Number(minVolume);

  return warrants.filter((warrant) => {
    if (issuerFilter !== "all" && warrant.issuer !== issuerFilter) return false;
    if (Number.isFinite(minimumVolume) && minimumVolume > 0 && (warrant.volume ?? 0) < minimumVolume) return false;

    const premium = warrant.metrics.premiumPercent;
    if (premiumFilter === "low") return premium !== null && premium <= premiumLowThreshold;
    if (premiumFilter === "medium") return premium !== null && premium > premiumLowThreshold && premium < premiumHighThreshold;
    if (premiumFilter === "high") return premium !== null && premium >= premiumHighThreshold;

    return true;
  });
}

function sortWarrants(warrants: CoveredWarrantWithMetrics[], sortMode: SortMode): CoveredWarrantWithMetrics[] {
  return [...warrants].sort((a, b) => {
    if (sortMode === "premium") {
      return nullableSortValue(a.metrics.premiumPercent) - nullableSortValue(b.metrics.premiumPercent);
    }

    if (sortMode === "breakeven") {
      return nullableSortValue(a.metrics.breakEvenPrice) - nullableSortValue(b.metrics.breakEvenPrice);
    }

    if (sortMode === "low-price") {
      return nullableSortValue(a.lastPrice) - nullableSortValue(b.lastPrice);
    }

    const liquidityDiff = (b.volume ?? 0) - (a.volume ?? 0);
    if (liquidityDiff !== 0) return liquidityDiff;
    return nullableSortValue(a.metrics.premiumPercent) - nullableSortValue(b.metrics.premiumPercent);
  });
}

function buildCoveredWarrantSummary(warrants: CoveredWarrantWithMetrics[]) {
  return {
    bestLiquidity: [...warrants].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))[0] ?? null,
    lowestPremium: [...warrants]
      .filter((warrant) => warrant.metrics.premiumPercent !== null)
      .sort((a, b) => (a.metrics.premiumPercent ?? 0) - (b.metrics.premiumPercent ?? 0))[0] ?? null,
    lowestBreakEven: [...warrants]
      .filter((warrant) => warrant.metrics.breakEvenPrice !== null)
      .sort((a, b) => (a.metrics.breakEvenPrice ?? 0) - (b.metrics.breakEvenPrice ?? 0))[0] ?? null,
  };
}

function getWarrantBadges(warrant: CoveredWarrantWithMetrics): Array<{ label: string; className: string }> {
  const badges: Array<{ label: string; className: string }> = [];
  const premium = warrant.metrics.premiumPercent;
  const volume = warrant.volume ?? 0;
  const price = warrant.lastPrice ?? 0;

  if (premium !== null && premium <= premiumLowThreshold) {
    badges.push({ label: "Premium thấp", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" });
  }

  if (premium !== null && premium >= premiumHighThreshold) {
    badges.push({ label: "Premium cao", className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" });
  }

  if (volume >= strongVolumeThreshold) {
    badges.push({ label: "Thanh khoản tốt", className: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" });
  } else if (volume > 0 && volume < weakVolumeThreshold) {
    badges.push({ label: "Thanh khoản thấp", className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" });
  }

  if (price > 0 && (price <= lowPriceRiskThreshold || volume < weakVolumeThreshold)) {
    badges.push({ label: "Rủi ro cao", className: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" });
  }

  return badges.length > 0
    ? badges
    : [{ label: "Theo dõi", className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" }];
}

function getIssuers(warrants: CoveredWarrantWithMetrics[]): string[] {
  return [...new Set(warrants.map((warrant) => warrant.issuer).filter((issuer): issuer is string => Boolean(issuer)))]
    .sort((a, b) => a.localeCompare(b));
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

function nullableSortValue(value: number | null): number {
  return value === null ? Number.POSITIVE_INFINITY : value;
}

function formatSource(value: string | null | undefined): string {
  return value === "24hmoney" ? "24HMoney" : value ?? "Supabase";
}

function formatPrice(value: number | null): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : "—";
}

function formatPercent(value: number | null): string {
  return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(2)}%` : "—";
}

function formatVolume(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
}
