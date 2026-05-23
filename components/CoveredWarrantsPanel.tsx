"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { analyzeCoveredWarrant, type CoveredWarrantAnalysis } from "@/lib/cw/cw-analysis";
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

type UnderlyingsPayload = {
  ok: boolean;
  underlyings?: string[];
};

type UnderlyingsState = {
  status: "idle" | "loading" | "ready" | "error";
  underlyings: string[];
  message: string | null;
};

type CoveredWarrantTab = "compare" | "underlyings";

type SortMode = "liquidity" | "premium" | "breakeven" | "low-price";
type PremiumFilter = "all" | "low" | "medium" | "high";

const premiumLowThreshold = 5;
const premiumHighThreshold = 20;
const strongVolumeThreshold = 100_000;
const weakVolumeThreshold = 10_000;
const lowPriceRiskThreshold = 0.1;

export function CoveredWarrantsPanel({ active }: { active: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [compactQuery, setCompactQuery] = useState("");
  const [submittedUnderlying, setSubmittedUnderlying] = useState("");
  const searchInputWrapRef = useRef<HTMLDivElement | null>(null);
  const [compactSearchVisible, setCompactSearchVisible] = useState(false);
  const [activeCoveredWarrantTab, setActiveCoveredWarrantTab] = useState<CoveredWarrantTab>("compare");
  const [underlyingsState, setUnderlyingsState] = useState<UnderlyingsState>({
    status: "idle",
    underlyings: [],
    message: null,
  });
  const [sortMode, setSortMode] = useState<SortMode>("liquidity");
  const [issuerFilter, setIssuerFilter] = useState("all");
  const [premiumFilter, setPremiumFilter] = useState<PremiumFilter>("all");
  const [minVolume, setMinVolume] = useState("");
  const [state, setState] = useState<LoadState>({
    status: "intro",
    message: "Nhập mã cơ sở để xem chứng quyền đang giao dịch.",
    warrants: [],
  });

  const [compactState, setCompactState] = useState<LoadState>({
    status: "intro",
    message: null,
    warrants: [],
  });

  const issuers = useMemo(() => getIssuers(state.warrants), [state.warrants]);
  const displayWarrants = useMemo(
    () => sortWarrants(filterWarrants(state.warrants, issuerFilter, premiumFilter, minVolume), sortMode),
    [issuerFilter, minVolume, premiumFilter, sortMode, state.warrants],
  );
  const summary = useMemo(() => buildCoveredWarrantSummary(state.warrants), [state.warrants]);
  const analysisMap = useMemo(() => buildAnalysisMap(state.warrants), [state.warrants]);
  const scannerGroups = useMemo(() => buildCoveredWarrantScannerGroups(state.warrants, analysisMap), [analysisMap, state.warrants]);
  const dataSource = state.warrants.find((warrant) => warrant.source)?.source;
  const normalizedQuery = useMemo(() => normalizeUnderlying(query), [query]);
  const normalizedCompactQuery = useMemo(() => normalizeUnderlying(compactQuery), [compactQuery]);
  const compactCanSearch = normalizedCompactQuery.length > 0;

  useEffect(() => {
    function handleCoveredWarrantTabChange(event: Event) {
      const detail = (event as CustomEvent<CoveredWarrantTab>).detail;
      if (detail === "compare" || detail === "underlyings") {
        setActiveCoveredWarrantTab(detail);
      }
    }

    window.addEventListener("covered-warrant-tab-change", handleCoveredWarrantTabChange);
    return () => window.removeEventListener("covered-warrant-tab-change", handleCoveredWarrantTabChange);
  }, []);

  useEffect(() => {
    if (!active || activeCoveredWarrantTab !== "underlyings" || underlyingsState.status !== "idle") return;
    void loadUnderlyings();
  }, [active, activeCoveredWarrantTab, underlyingsState.status]);

  useEffect(() => {
    if (!active) {
      setCompactSearchVisible(false);
      resetPanelState();
      return;
    }

    function updateCompactVisibility() {
      const target = searchInputWrapRef.current;
      if (!target) return;

      const stickyTriggerTop = window.innerWidth >= 640 ? 120 : 112;
      const rect = target.getBoundingClientRect();
      const nextVisible = rect.bottom <= stickyTriggerTop + 8;
      setCompactSearchVisible((wasVisible) => {
        if (!wasVisible && nextVisible) {
          setCompactQuery(query);
          setCompactState({ status: "intro", message: null, warrants: [] });
        }
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
  }, [active, query]);

  async function runSearch(normalized: string) {
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

  async function submitSearch(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    await runSearch(normalizedQuery);
  }

  async function loadUnderlyings() {
    setUnderlyingsState({ status: "loading", underlyings: [], message: null });

    try {
      const response = await fetch("/api/cw/underlyings?limit=200", { cache: "no-store" });
      const payload = (await response.json()) as UnderlyingsPayload;

      if (!response.ok || !payload.ok) {
        throw new Error("Không tải được danh sách mã cơ sở.");
      }

      setUnderlyingsState({
        status: "ready",
        underlyings: payload.underlyings ?? [],
        message: null,
      });
    } catch (error) {
      setUnderlyingsState({
        status: "error",
        underlyings: [],
        message: error instanceof Error ? error.message : "Không tải được danh sách mã cơ sở.",
      });
    }
  }

  async function selectUnderlying(underlying: string) {
    const normalized = normalizeUnderlying(underlying);
    setQuery(normalized);
    setCompactQuery("");
    resetCompactSearchState();
    setActiveCoveredWarrantTab("compare");
    window.dispatchEvent(new CustomEvent("covered-warrant-tab-change", { detail: "compare" }));
    requestAnimationFrame(() => searchInputWrapRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
    await runSearch(normalized);
  }

  async function submitCompactSearch(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const normalized = normalizedCompactQuery;
    if (!normalized) {
      setCompactState({ status: "intro", message: null, warrants: [] });
      return;
    }

    setQuery(normalized);
    setSubmittedUnderlying(normalized);
    setState({ status: "loading", message: null, warrants: [] });
    setCompactState({ status: "loading", message: null, warrants: [] });

    try {
      const response = await fetch(`/api/cw/search?underlying=${encodeURIComponent(normalized)}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as SearchPayload;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message ?? "Không tải được dữ liệu chứng quyền.");
      }

      const nextState: LoadState = {
        status: "ready",
        message: payload.message ?? null,
        warrants: payload.warrants ?? [],
      };
      setState(nextState);
      setCompactState(nextState);
    } catch (error) {
      const nextState: LoadState = {
        status: "error",
        message: error instanceof Error ? error.message : "Không tải được dữ liệu chứng quyền.",
        warrants: [],
      };
      setState(nextState);
      setCompactState(nextState);
    }
  }

  function resetPanelState() {
    setQuery("");
    setSubmittedUnderlying("");
    setSortMode("liquidity");
    setIssuerFilter("all");
    setPremiumFilter("all");
    setMinVolume("");
    setState({
      status: "intro",
      message: "Nhập mã cơ sở để xem chứng quyền đang giao dịch.",
      warrants: [],
    });
    resetCompactSearchState();
  }

  function resetCompactSearchState() {
    setCompactQuery("");
    setCompactState({ status: "intro", message: null, warrants: [] });
  }

  function clearCompactSearch() {
    setCompactQuery("");
    setQuery("");
    setCompactState({ status: "intro", message: null, warrants: [] });
  }

  if (!active) return null;

  if (activeCoveredWarrantTab === "underlyings") {
    return (
      <section className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[28px] border border-cyan-400/20 bg-[#061426] p-5 shadow-[0_18px_70px_rgba(0,210,255,0.08)]">
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-cyan-300/30 bg-cyan-400/10 text-cyan-200">
              CW
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Mã cơ sở</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-white">Chọn mã có chứng quyền</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Chọn một mã cơ sở để tự điền vào tab So sánh và xem danh sách chứng quyền đang giao dịch.
              </p>
            </div>
          </div>

          <div className="mt-5">
            {underlyingsState.status === "loading" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-16 animate-pulse rounded-2xl bg-cyan-400/10" />
                ))}
              </div>
            ) : underlyingsState.status === "error" ? (
              <div className="rounded-2xl border border-rose-300/20 bg-rose-400/10 p-4 text-sm text-rose-100">
                {underlyingsState.message}
              </div>
            ) : underlyingsState.underlyings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-cyan-300/20 bg-[#07172a] p-5 text-sm text-slate-400">
                Chưa có mã cơ sở nào có chứng quyền đang giao dịch.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {underlyingsState.underlyings.map((underlying) => (
                  <button
                    key={underlying}
                    type="button"
                    onClick={() => void selectUnderlying(underlying)}
                    className="group flex items-center justify-between rounded-2xl border border-cyan-300/15 bg-[#0a1c33] px-4 py-3 text-left transition hover:border-cyan-300/45 hover:bg-cyan-400/10"
                  >
                    <span>
                      <span className="block text-lg font-black text-white">{underlying}</span>
                      <span className="mt-1 block text-xs text-slate-400">Xem chứng quyền đang giao dịch</span>
                    </span>
                    <span className="text-cyan-300 transition group-hover:translate-x-1">›</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
      <div
        className={`sticky top-[112px] z-30 -mx-1 h-0 overflow-visible transition-all duration-200 sm:top-[120px] ${
          compactSearchVisible ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
        }`}
        aria-hidden={!compactSearchVisible}
      >
        <div className="relative rounded-2xl border border-cyan-300/20 bg-[#071a31]/95 p-2 shadow-[0_14px_40px_rgba(0,0,0,0.26)] backdrop-blur-xl">
          <form
            onSubmit={submitCompactSearch}
            className="flex min-h-11 items-center rounded-xl border border-cyan-400/25 bg-[#10223b] px-3 focus-within:border-cyan-300/70 focus-within:shadow-[0_0_22px_rgba(34,211,238,0.12)]"
          >
            <span className="mr-3 text-cyan-300">⌕</span>
            <input
              type="search"
              value={compactQuery}
              onChange={(event) => {
                setCompactQuery(event.target.value.toUpperCase());
                setCompactState({ status: "intro", message: null, warrants: [] });
              }}
              placeholder="Nhập mã cơ sở, ví dụ FPT"
              className="min-h-11 min-w-0 flex-1 bg-transparent text-sm font-semibold uppercase text-white outline-none placeholder:font-normal placeholder:normal-case placeholder:text-slate-500"
            />
            {compactQuery ? (
              <button
                type="button"
                onClick={clearCompactSearch}
                className="ml-2 rounded-full border border-cyan-400/15 px-3 py-1 text-xs font-medium text-slate-300 transition hover:border-cyan-300/40 hover:text-white"
              >
                Xóa
              </button>
            ) : (
              <span className="ml-2 text-slate-500">⌘</span>
            )}
            <button
              type="submit"
              disabled={!compactCanSearch || compactState.status === "loading"}
              className="ml-2 rounded-full bg-cyan-300 px-3 py-1 text-xs font-black text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {compactState.status === "loading" ? "Đang tải" : "Tìm"}
            </button>
          </form>
          {compactQuery && compactState.status !== "intro" ? (
            <CompactCoveredWarrantPanel
              warrants={compactState.warrants}
              status={compactState.status}
              message={compactState.message}
              canSearch={compactCanSearch}
              underlying={normalizedCompactQuery}
            />
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-cyan-400/20 bg-[#061426] shadow-[0_18px_70px_rgba(0,210,255,0.08)]">
        <div className="relative p-5 sm:p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(34,211,238,0.16),transparent_30%),radial-gradient(circle_at_85%_0%,rgba(16,185,129,0.12),transparent_28%)]" />
          <div className="relative flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-cyan-300/30 bg-cyan-400/10 text-xl text-cyan-200 shadow-[0_0_28px_rgba(34,211,238,0.16)]">
                CW
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Chứng quyền</p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">So sánh chứng quyền</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                  Tìm theo mã cơ sở để xem premium, hòa vốn và thanh khoản của các chứng quyền đang giao dịch.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-300/25 bg-amber-500/10 px-4 py-3 text-xs leading-5 text-amber-100">
              Chứng quyền có rủi ro cao, dữ liệu chỉ mang tính tham khảo, không phải khuyến nghị mua/bán.
            </div>

            <form onSubmit={submitSearch} className="flex flex-col gap-3 sm:flex-row">
              <div
                ref={searchInputWrapRef}
                className="flex min-h-14 flex-1 items-center gap-3 rounded-2xl border border-cyan-300/25 bg-[#091a30]/90 px-4 shadow-inner shadow-black/20 transition focus-within:border-cyan-300/70 focus-within:shadow-[0_0_0_3px_rgba(34,211,238,0.10)]"
              >
                <span className="text-lg text-cyan-300">⌕</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value.toUpperCase())}
                  placeholder="Nhập mã cơ sở, ví dụ FPT"
                  className="min-h-14 flex-1 bg-transparent text-base font-semibold uppercase text-white outline-none placeholder:font-normal placeholder:normal-case placeholder:text-slate-500"
                />
              </div>
              <button
                type="submit"
                className="min-h-14 rounded-2xl border border-cyan-300/30 bg-gradient-to-r from-cyan-400 to-emerald-300 px-5 text-sm font-bold text-slate-950 shadow-[0_14px_34px_rgba(34,211,238,0.18)] transition hover:brightness-110 active:scale-[0.99]"
              >
                Tìm chứng quyền
              </button>
            </form>
          </div>
        </div>
      </div>

      {state.status === "intro" ? (
        <CoveredWarrantState title="Nhập mã cơ sở" description={state.message ?? "Nhập mã cơ sở để xem chứng quyền đang giao dịch."} />
      ) : state.status === "loading" ? (
        <CoveredWarrantSkeleton />
      ) : state.status === "error" ? (
        <CoveredWarrantState title="Không tải được chứng quyền" description={state.message ?? "Vui lòng thử lại sau."} />
      ) : state.warrants.length === 0 ? (
        <CoveredWarrantState
          title={submittedUnderlying ? `Không tìm thấy chứng quyền đang giao dịch cho ${submittedUnderlying}` : "Chưa có dữ liệu chứng quyền"}
          description={state.message ?? "Chưa có dữ liệu chứng quyền. Hãy chạy đồng bộ CW từ provider."}
        />
      ) : (
        <>
          <section className="mt-5 overflow-hidden rounded-[30px] border border-cyan-400/20 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.14),transparent_36%),linear-gradient(145deg,#061426,#071b32_54%,#04101f)] p-5 shadow-[0_22px_80px_rgba(0,210,255,0.10)]">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 text-xl text-cyan-200 shadow-[0_0_28px_rgba(34,211,238,0.14)]">
                  ↗
                </span>
                <div>
                  <h3 className="text-2xl font-black tracking-tight text-white">Tổng quan Covered Warrant</h3>
                  <p className="mt-1 text-sm text-slate-400">Cập nhật mới nhất từ thị trường</p>
                </div>
              </div>
              <span className="shrink-0 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-xs font-black text-cyan-200">
                ● LIVE
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <SummaryCard label="CW hiện có" value={state.warrants.length.toString()} helper={submittedUnderlying} />
              <SummaryCard label="Thanh khoản tốt nhất" value={summary.bestLiquidity?.symbol ?? "-"} helper={formatVolume(summary.bestLiquidity?.volume ?? null)} />
              <SummaryCard label="Premium thấp nhất" value={summary.lowestPremium?.symbol ?? "-"} helper={formatPercent(summary.lowestPremium?.metrics.premiumPercent)} />
              <SummaryCard label="Hòa vốn thấp nhất" value={summary.lowestBreakEven?.symbol ?? "-"} helper={formatPrice(summary.lowestBreakEven?.metrics.breakEvenPrice ?? null)} />
              <SummaryCard label="Nguồn dữ liệu" value={formatSource(dataSource)} helper="Supabase" />
            </div>
            <p className="mt-5 flex items-center gap-2 text-xs text-slate-500">
              <span className="grid h-5 w-5 place-items-center rounded-full border border-cyan-300/20 text-cyan-300">i</span>
              Dữ liệu được cập nhật liên tục trong phiên giao dịch.
            </p>
          </section>

          <CoveredWarrantScanner groups={scannerGroups} analysisMap={analysisMap} />

          <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
            <p className="font-semibold">Lưu ý khi so sánh chứng quyền</p>
            <p className="mt-1">
              Premium thấp không đồng nghĩa an toàn. Cần xét thanh khoản, thời gian đáo hạn và biến động mã cơ sở.
              Dữ liệu chỉ mang tính tham khảo, không phải khuyến nghị mua/bán.
            </p>
          </div>

          <div className="mt-5 rounded-2xl border border-cyan-400/15 bg-[#07172a] p-4 shadow-[0_16px_50px_rgba(0,0,0,0.18)]">
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

          <div className="mt-5 overflow-hidden rounded-2xl border border-cyan-400/15 bg-[#07172a] shadow-[0_16px_50px_rgba(0,0,0,0.18)]">
            <div className="border-b border-cyan-400/10 px-4 py-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">
                    Chứng quyền đang giao dịch theo <span className="text-cyan-300">{submittedUnderlying}</span>
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    Hiển thị {displayWarrants.length}/{state.warrants.length} mã sau lọc.
                  </p>
                </div>
                <p className="text-xs text-slate-400">Các cột thiếu dữ liệu từ list page đã được ẩn.</p>
              </div>
            </div>

            {displayWarrants.length === 0 ? (
              <div className="p-5 text-sm text-slate-400">Không có chứng quyền phù hợp bộ lọc hiện tại.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[860px] w-full text-left text-sm">
                  <thead className="bg-[#03101f] text-xs uppercase text-slate-400">
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
                  <tbody className="divide-y divide-cyan-400/10">
                    {displayWarrants.map((warrant) => (
                      <tr
                        key={warrant.symbol}
                        tabIndex={0}
                        role="link"
                        onClick={() => router.push(`/cw/${encodeURIComponent(warrant.symbol)}`)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            router.push(`/cw/${encodeURIComponent(warrant.symbol)}`);
                          }
                        }}
                        className="cursor-pointer transition hover:bg-cyan-400/5 focus:bg-cyan-400/10 focus:outline-none"
                      >
                        <TableCell>
                          <span className="font-bold text-white">{warrant.symbol}</span>
                          {warrant.type ? (
                            <span className="ml-2 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-2 py-0.5 text-[11px] font-semibold uppercase text-cyan-200">
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
                            <span className="rounded-full border border-cyan-300/15 px-2 py-1 text-[11px] font-semibold text-cyan-200">
                              Xem
                            </span>
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
  "min-h-11 w-full rounded-xl border border-cyan-400/15 bg-[#03101f] px-3 text-sm text-white outline-none transition focus:border-cyan-300/60 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.10)]";

function ControlField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-400">{label}</span>
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

function buildAnalysisMap(warrants: CoveredWarrantWithMetrics[]): Map<string, CoveredWarrantAnalysis> {
  return new Map(warrants.map((warrant) => [warrant.symbol, analyzeCoveredWarrant(warrant, warrants, null)]));
}

function buildCoveredWarrantScannerGroups(
  warrants: CoveredWarrantWithMetrics[],
  analysisMap: Map<string, CoveredWarrantAnalysis>,
): CwScannerGroup[] {
  const byScore = (a: CoveredWarrantWithMetrics, b: CoveredWarrantWithMetrics) =>
    (analysisMap.get(b.symbol)?.cwScore ?? 0) - (analysisMap.get(a.symbol)?.cwScore ?? 0);

  return [
    {
      id: "balanced",
      title: "CW hấp dẫn cân bằng",
      subtitle: "Điểm tổng hợp tốt, không dùng như khuyến nghị mua/bán.",
      warrants: [...warrants]
        .filter((warrant) => (analysisMap.get(warrant.symbol)?.riskLevel ?? "medium") !== "high")
        .sort(byScore)
        .slice(0, 5),
    },
    {
      id: "low-premium",
      title: "Premium thấp nhất",
      subtitle: "Ưu tiên premium thấp trong nhóm đang xem.",
      warrants: [...warrants]
        .filter((warrant) => warrant.metrics.premiumPercent !== null)
        .sort((a, b) => (a.metrics.premiumPercent ?? 0) - (b.metrics.premiumPercent ?? 0))
        .slice(0, 5),
    },
    {
      id: "liquidity",
      title: "Thanh khoản tốt nhất",
      subtitle: "Dễ quan sát hơn nhờ khối lượng cao.",
      warrants: [...warrants].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0)).slice(0, 5),
    },
    {
      id: "near-breakeven",
      title: "Hòa vốn gần nhất",
      subtitle: "Khoảng cách tới hòa vốn thấp hơn tương đối.",
      warrants: [...warrants]
        .filter((warrant) => analysisMap.get(warrant.symbol)?.distanceToBreakEvenPercent !== null)
        .sort(
          (a, b) =>
            (analysisMap.get(a.symbol)?.distanceToBreakEvenPercent ?? Number.POSITIVE_INFINITY) -
            (analysisMap.get(b.symbol)?.distanceToBreakEvenPercent ?? Number.POSITIVE_INFINITY),
        )
        .slice(0, 5),
    },
    {
      id: "high-risk",
      title: "Rủi ro cao cần tránh",
      subtitle: "Các mã có nhiều yếu tố rủi ro tương đối.",
      warrants: [...warrants]
        .filter((warrant) => analysisMap.get(warrant.symbol)?.riskLevel === "high")
        .sort((a, b) => (analysisMap.get(a.symbol)?.cwScore ?? 0) - (analysisMap.get(b.symbol)?.cwScore ?? 0))
        .slice(0, 5),
    },
  ];
}

function getWarrantBadges(warrant: CoveredWarrantWithMetrics): Array<{ label: string; className: string }> {
  const badges: Array<{ label: string; className: string }> = [];
  const premium = warrant.metrics.premiumPercent;
  const volume = warrant.volume ?? 0;
  const price = warrant.lastPrice ?? 0;

  if (premium !== null && premium <= premiumLowThreshold) {
    badges.push({ label: "Premium thấp", className: "border border-emerald-300/20 bg-emerald-400/10 text-emerald-200" });
  }

  if (premium !== null && premium >= premiumHighThreshold) {
    badges.push({ label: "Premium cao", className: "border border-amber-300/20 bg-amber-400/10 text-amber-200" });
  }

  if (volume >= strongVolumeThreshold) {
    badges.push({ label: "Thanh khoản tốt", className: "border border-cyan-300/20 bg-cyan-400/10 text-cyan-200" });
  } else if (volume > 0 && volume < weakVolumeThreshold) {
    badges.push({ label: "Thanh khoản thấp", className: "border border-slate-500/20 bg-slate-500/10 text-slate-300" });
  }

  if (price > 0 && (price <= lowPriceRiskThreshold || volume < weakVolumeThreshold)) {
    badges.push({ label: "Rủi ro cao", className: "border border-rose-300/20 bg-rose-400/10 text-rose-200" });
  }

  return badges.length > 0
    ? badges
    : [{ label: "Theo dõi", className: "border border-slate-500/20 bg-slate-500/10 text-slate-300" }];
}

function getIssuers(warrants: CoveredWarrantWithMetrics[]): string[] {
  return [...new Set(warrants.map((warrant) => warrant.issuer).filter((issuer): issuer is string => Boolean(issuer)))]
    .sort((a, b) => a.localeCompare(b));
}

function CompactCoveredWarrantPanel({
  warrants,
  status,
  message,
  canSearch,
  underlying,
}: {
  warrants: CoveredWarrantWithMetrics[];
  status: LoadState["status"];
  message: string | null;
  canSearch: boolean;
  underlying: string;
}) {
  const topWarrants = warrants.slice(0, 5);

  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-cyan-400/15 bg-[#071426] shadow-[0_18px_42px_rgba(0,0,0,0.30)]">
      {!canSearch ? (
        <p className="px-4 py-4 text-sm text-slate-400">{message}</p>
      ) : status === "loading" ? (
        <div className="space-y-2 p-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-12 animate-pulse rounded-lg bg-cyan-400/10" />
          ))}
        </div>
      ) : status === "error" ? (
        <p className="px-4 py-4 text-sm text-rose-200">{message ?? "Không tải được dữ liệu chứng quyền."}</p>
      ) : topWarrants.length === 0 ? (
        <p className="px-4 py-4 text-sm text-slate-400">
          {message ?? `Không tìm thấy chứng quyền đang giao dịch cho ${underlying}.`}
        </p>
      ) : (
        <div className="divide-y divide-cyan-400/10">
          {topWarrants.map((warrant) => (
            <Link
              key={warrant.symbol}
              href={`/cw/${encodeURIComponent(warrant.symbol)}`}
              className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-cyan-400/5"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-base font-black text-white">{warrant.symbol}</p>
                  {warrant.issuer ? (
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-bold text-cyan-200">
                      {warrant.issuer}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-xs text-slate-400">
                  Hòa vốn {formatPrice(warrant.metrics.breakEvenPrice)} · Premium {formatPercent(warrant.metrics.premiumPercent)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-bold text-white">{formatPrice(warrant.lastPrice)}</p>
                <p className="mt-1 text-xs font-semibold text-cyan-200">{formatVolume(warrant.volume)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

type CwScannerGroup = {
  id: string;
  title: string;
  subtitle: string;
  warrants: CoveredWarrantWithMetrics[];
};

function CoveredWarrantScanner({
  groups,
  analysisMap,
}: {
  groups: CwScannerGroup[];
  analysisMap: Map<string, CoveredWarrantAnalysis>;
}) {
  const visibleGroups = groups.filter((group) => group.warrants.length > 0);

  if (visibleGroups.length === 0) {
    return (
      <section className="mt-5 rounded-2xl border border-dashed border-cyan-400/20 bg-[#07172a] p-5 text-sm text-slate-400">
        Chưa có đủ dữ liệu để tạo nhóm phân tích chứng quyền.
      </section>
    );
  }

  return (
    <section className="mt-5 rounded-[28px] border border-cyan-400/20 bg-[#061426] p-4 shadow-[0_18px_60px_rgba(0,210,255,0.08)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-black text-white">Tín hiệu chứng quyền</h3>
          <p className="mt-1 text-sm text-slate-400">Các nhóm so sánh tương đối theo dữ liệu hiện có.</p>
        </div>
        <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-100">
          {visibleGroups.length} nhóm
        </span>
      </div>

      <div className="space-y-4">
        {visibleGroups.map((group) => (
          <div key={group.id} className="border-t border-cyan-400/10 pt-4 first:border-t-0 first:pt-0">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h4 className="font-black text-white">{group.title}</h4>
                <p className="mt-0.5 text-xs text-slate-400">{group.subtitle}</p>
              </div>
              <span className="text-xs font-semibold text-slate-400">{group.warrants.length} mã</span>
            </div>
            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {group.warrants.map((warrant) => (
                <CwSignalCard key={`${group.id}-${warrant.symbol}`} warrant={warrant} analysis={analysisMap.get(warrant.symbol)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CwSignalCard({
  warrant,
  analysis,
}: {
  warrant: CoveredWarrantWithMetrics;
  analysis: CoveredWarrantAnalysis | undefined;
}) {
  return (
    <Link
      href={`/cw/${encodeURIComponent(warrant.symbol)}`}
      className="min-w-[190px] rounded-2xl border border-cyan-300/15 bg-[#0a1c33] p-3 transition hover:border-cyan-300/35 hover:bg-cyan-400/10"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-black text-white">{warrant.symbol}</p>
          <p className="mt-1 text-xs font-semibold text-cyan-200">{warrant.issuer ?? warrant.underlyingSymbol}</p>
        </div>
        <span className={`rounded-full px-2 py-1 text-[11px] font-black ${getAnalysisBadgeClass(analysis?.riskLevel)}`}>
          {analysis?.cwScore ?? "--"}/100
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-slate-500">Premium</p>
          <p className="mt-1 font-black text-white">{formatPercent(warrant.metrics.premiumPercent)}</p>
        </div>
        <div>
          <p className="text-slate-500">Volume</p>
          <p className="mt-1 font-black text-white">{formatVolume(warrant.volume)}</p>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-400">
        {analysis?.scoreLabelVi ?? "Cần theo dõi"} · Hòa vốn {formatPrice(warrant.metrics.breakEvenPrice)}
      </p>
    </Link>
  );
}

function getAnalysisBadgeClass(level: CoveredWarrantAnalysis["riskLevel"] | undefined): string {
  if (level === "high") return "border border-rose-300/20 bg-rose-400/10 text-rose-100";
  if (level === "medium") return "border border-amber-300/20 bg-amber-400/10 text-amber-100";
  return "border border-emerald-300/20 bg-emerald-400/10 text-emerald-100";
}

function SummaryCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  const tone = getSummaryTone(label);
  const isSource = label.includes("Ngu");
  const isCount = label.includes("CW");

  return (
    <div className={`group relative min-h-[136px] overflow-hidden rounded-3xl border p-3.5 shadow-[0_14px_42px_rgba(0,0,0,0.22)] sm:p-4 ${isSource ? "col-span-2 min-h-[108px]" : ""} ${tone.card}`}>
      <div className={`absolute -right-10 -top-10 h-24 w-24 rounded-full blur-3xl ${tone.glow}`} />
      <div className={`absolute -bottom-14 left-1/2 h-20 w-32 -translate-x-1/2 rounded-full blur-3xl ${tone.bottomGlow}`} />
      <div className={`pointer-events-none absolute bottom-6 left-3.5 h-px w-24 ${tone.line}`} />
      <div className={`relative flex h-full ${isSource ? "items-center justify-between gap-3" : "flex-col justify-between gap-3"}`}>
        <div className={`flex ${isSource ? "items-center gap-4" : "items-start justify-between gap-3"}`}>
          <span className={`grid shrink-0 place-items-center rounded-2xl border font-black shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ${isSource ? "h-12 w-12 text-xl" : "h-10 w-10 text-base"} ${tone.icon}`}>
            {tone.symbol}
          </span>
          {!isSource ? <span className={`mt-2 text-lg leading-none ${tone.helper}`}>•••</span> : null}
        </div>

        <div className={`min-w-0 ${isSource ? "flex-1" : ""}`}>
          <p className="truncate text-[11px] font-semibold text-slate-400 sm:text-xs">{label}</p>
          <p className={`${isSource ? "mt-1 text-2xl sm:text-3xl" : isCount ? "mt-3 text-4xl" : "mt-3 text-[clamp(1.15rem,5vw,1.55rem)]"} max-w-full truncate font-black leading-none tracking-tight text-white`}>
            {value}
          </p>
          <p className={`mt-2 truncate text-xs font-black sm:text-sm ${tone.helper}`}>{helper}</p>
        </div>
      </div>
    </div>
  );
}

function getSummaryTone(label: string): {
  card: string;
  glow: string;
  bottomGlow: string;
  helper: string;
  icon: string;
  line: string;
  symbol: string;
} {
  if (label.includes("Thanh")) {
    return {
      card: "border-emerald-300/35 bg-[linear-gradient(145deg,rgba(6,48,54,0.96),rgba(6,31,42,0.94))]",
      glow: "bg-emerald-300/20",
      bottomGlow: "bg-emerald-300/18",
      helper: "text-emerald-200",
      icon: "border-emerald-300/25 bg-emerald-400/10 text-emerald-200",
      line: "bg-gradient-to-r from-transparent via-emerald-300/80 to-transparent",
      symbol: "↟",
    };
  }

  if (label.includes("Premium")) {
    return {
      card: "border-violet-300/35 bg-[linear-gradient(145deg,rgba(28,25,66,0.96),rgba(9,22,42,0.94))]",
      glow: "bg-violet-300/18",
      bottomGlow: "bg-violet-300/16",
      helper: "text-violet-200",
      icon: "border-violet-300/25 bg-violet-400/10 text-violet-200",
      line: "bg-gradient-to-r from-transparent via-violet-300/80 to-transparent",
      symbol: "%",
    };
  }

  if (label.includes("H")) {
    return {
      card: "border-sky-300/30 bg-[linear-gradient(145deg,rgba(7,39,72,0.96),rgba(7,24,45,0.94))]",
      glow: "bg-sky-300/18",
      bottomGlow: "bg-sky-300/16",
      helper: "text-sky-200",
      icon: "border-sky-300/25 bg-sky-400/10 text-sky-200",
      line: "bg-gradient-to-r from-transparent via-sky-300/80 to-transparent",
      symbol: "⌁",
    };
  }

  if (label.includes("Ngu")) {
    return {
      card: "border-cyan-300/25 bg-[linear-gradient(145deg,rgba(8,43,59,0.94),rgba(7,20,35,0.96))]",
      glow: "bg-cyan-300/14",
      bottomGlow: "bg-cyan-300/12",
      helper: "text-cyan-200",
      icon: "border-cyan-300/25 bg-cyan-400/10 text-cyan-200",
      line: "bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent",
      symbol: "●",
    };
  }

  return {
    card: "border-cyan-300/30 bg-[linear-gradient(145deg,rgba(6,47,68,0.96),rgba(6,23,42,0.94))]",
    glow: "bg-cyan-300/20",
    bottomGlow: "bg-cyan-300/16",
    helper: "text-cyan-200",
    icon: "border-cyan-300/25 bg-cyan-400/10 text-cyan-200",
    line: "bg-gradient-to-r from-transparent via-cyan-300/80 to-transparent",
    symbol: "◇",
  };
}

function CoveredWarrantSkeleton() {
  return (
    <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-28 animate-pulse rounded-2xl border border-cyan-400/10 bg-cyan-400/10" />
      ))}
    </div>
  );
}

function CoveredWarrantState({ title, description }: { title: string; description: string }) {
  return (
    <div className="mt-5 rounded-2xl border border-dashed border-cyan-400/20 bg-[#07172a] p-6 text-center">
      <p className="text-base font-bold text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
    </div>
  );
}

function TableHead({ children }: { children: ReactNode }) {
  return <th className="whitespace-nowrap px-4 py-3 font-semibold">{children}</th>;
}

function TableCell({ children }: { children: ReactNode }) {
  return <td className="whitespace-nowrap px-4 py-3 text-slate-300">{children}</td>;
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
