import { CoveredWarrantsPanel } from "@/components/CoveredWarrantsPanel";
import { DataStatusPanel } from "@/components/DataStatusPanel";
import { HomeTabs } from "@/components/HomeTabs";
import { MarketAlerts } from "@/components/MarketAlerts";
import { MarketBreadth } from "@/components/MarketBreadth";
import { MarketNarrativeCard } from "@/components/MarketNarrativeCard";
import { MarketProductTabs } from "@/components/MarketProductTabs";
import { MarketScanner } from "@/components/MarketScanner";
import { SectorHeatmap } from "@/components/SectorHeatmap";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getDataFreshness } from "@/lib/data-source/prices";
import type { DataFreshnessResult } from "@/lib/data-source/provider";
import { vi } from "@/lib/i18n/vi";
import { buildMarketNarrative } from "@/lib/market/narrative";
import {
  readMarketAlertsSnapshot,
  readMarketBreadthSnapshot,
  readSectorHeatmapSnapshot,
} from "@/lib/pipeline/snapshot";
import { readHomeScannerSnapshot } from "@/lib/scanner/snapshot";

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string | string[]; product?: string | string[] }>;
}) {
  const query = await searchParams;
  const initialTab = getInitialTab(query?.tab);
  const initialProduct = getInitialProduct(query?.product);
  const emptyFreshness: DataFreshnessResult = { status: "empty", updatedAt: null };
  const [dataFreshness, mergedScannerSnapshot, sectorHeatmap, marketBreadth, marketAlerts] = await Promise.all([
    timedSnapshot("dataFreshness", getDataFreshness(), emptyFreshness),
    timedSnapshot("home_scanner", readHomeScannerSnapshot(), null),
    timedSnapshot("sector_heatmap", readSectorHeatmapSnapshot(), []),
    timedSnapshot("market_breadth", readMarketBreadthSnapshot(), null),
    timedSnapshot("market_alerts", readMarketAlertsSnapshot(), []),
  ]);
  const scannerStocks = getUniqueScannerStocks(mergedScannerSnapshot);
  const marketNarrative = await timedSnapshot(
    "market_narrative",
    buildMarketNarrative({
      breadth: marketBreadth,
      sectors: sectorHeatmap,
      scannerGroups: mergedScannerSnapshot,
      alerts: marketAlerts,
    }),
    null,
  );
  const averageScore =
    scannerStocks.length > 0
      ? Math.round(scannerStocks.reduce((total, stock) => total + stock.score, 0) / scannerStocks.length)
      : 0;
  const positiveCount = marketBreadth?.advancers ?? 0;
  const totalBreadthSymbols = marketBreadth?.totalSymbols ?? 0;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950 dark:bg-[#07111f] dark:text-white">
      <section className="bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_34%),linear-gradient(180deg,#081526_0%,#07111f_100%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_34%),linear-gradient(180deg,#06111f_0%,#07111f_100%)]">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <DataStatusPanel initialFreshness={dataFreshness} />
            <div className="flex justify-start lg:justify-end">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </section>

      <MarketProductTabs
        initialProduct={initialProduct}
        stocks={
          <HomeTabs
            initialTab={initialTab}
            discover={
              <>
                <HomeHero averageScore={averageScore} positiveCount={positiveCount} totalBreadthSymbols={totalBreadthSymbols} />
                {marketNarrative ? <MarketNarrativeCard narrative={marketNarrative} /> : null}
                <MarketScanner stocks={[]} snapshotGroups={mergedScannerSnapshot} />
                <MarketAlerts alerts={marketAlerts} />
                {marketBreadth ? <MarketBreadth breadth={marketBreadth} /> : <SnapshotEmptyState title="Độ rộng thị trường" />}
                <SectorHeatmap sectors={sectorHeatmap} />
              </>
            }
          />
        }
        coveredWarrants={<CoveredWarrantsPanel active />}
      />
    </main>
  );
}

function HomeHero({
  averageScore,
  positiveCount,
  totalBreadthSymbols,
}: {
  averageScore: number;
  positiveCount: number;
  totalBreadthSymbols: number;
}) {
  const positiveRatio = totalBreadthSymbols > 0 ? Math.round((positiveCount / totalBreadthSymbols) * 100) : 0;

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
      <div className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
        <div className="relative overflow-hidden rounded-2xl border border-cyan-400/15 bg-[#0b1b31] p-5 shadow-[0_18px_60px_rgba(8,145,178,0.12)] dark:bg-[#081526] sm:p-7">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(34,211,238,0.18),transparent_28%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.12),transparent_30%)]" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full border border-cyan-300/25 bg-cyan-400/10 text-cyan-300 shadow-[0_0_42px_rgba(34,211,238,0.15)]">
              <HeroChartIcon />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">{vi.home.eyebrow}</p>
              <h1 className="mt-3 max-w-2xl text-3xl font-semibold leading-tight tracking-normal text-white sm:text-5xl">
                {vi.home.title}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                {vi.home.description}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
          <MetricCard label={vi.home.averageScore} value={averageScore.toString()} tone="cyan" helper="Tổng hợp từ scanner" />
          <MetricCard
            label={vi.home.greenToday}
            value={`${positiveCount}/${totalBreadthSymbols}`}
            tone="emerald"
            helper={`${positiveRatio}% mã tăng giá`}
          />
        </div>
      </div>
    </section>
  );
}

function MetricCard({ label, value, helper, tone }: { label: string; value: string; helper: string; tone: "cyan" | "emerald" }) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-300 from-emerald-400/20 to-cyan-400/5"
      : "text-cyan-300 from-cyan-400/20 to-emerald-400/5";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-cyan-400/15 bg-[#0b1b31] p-5 shadow-[0_18px_50px_rgba(2,8,23,0.18)] dark:bg-[#081526]">
      <div className={`absolute right-4 top-4 h-16 w-16 rounded-full bg-gradient-to-br ${toneClass} opacity-80 blur-sm`} />
      <p className="relative text-sm text-slate-300">{label}</p>
      <p className={`relative mt-3 text-4xl font-semibold tabular-nums ${toneClass.split(" ")[0]}`}>{value}</p>
      <p className="relative mt-1 text-sm text-slate-400">{helper}</p>
    </div>
  );
}

function HeroChartIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M7 34l9-9 8 6 14-18" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 40h32" strokeLinecap="round" />
      <path d="M12 31v5M24 27v9M36 19v17" strokeLinecap="round" />
    </svg>
  );
}

function getInitialTab(tab: string | string[] | undefined): "discover" | "search" {
  const value = Array.isArray(tab) ? tab[0] : tab;
  return value === "search" ? "search" : "discover";
}

function getInitialProduct(product: string | string[] | undefined): "stocks" | "covered-warrants" {
  const value = Array.isArray(product) ? product[0] : product;
  return value === "covered-warrants" ? "covered-warrants" : "stocks";
}

async function timedSnapshot<T, F>(name: string, task: Promise<T>, fallback: F, timeoutMs = 2_500): Promise<T | F> {
  const startedAt = Date.now();

  try {
    const result = await Promise.race<T | F>([
      task,
      new Promise<F>((resolve) => {
        setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);

    console.info("home snapshot fetch", {
      name,
      durationMs: Date.now() - startedAt,
      loaded: result !== fallback,
    });

    return result;
  } catch (error) {
    console.warn("home snapshot fetch failed", {
      name,
      durationMs: Date.now() - startedAt,
      error,
    });
    return fallback;
  }
}

function getUniqueScannerStocks(groups: Awaited<ReturnType<typeof readHomeScannerSnapshot>>) {
  const bySymbol = new Map<string, NonNullable<typeof groups>[number]["items"][number]["stock"]>();

  for (const group of groups ?? []) {
    for (const item of group.items) {
      bySymbol.set(item.stock.symbol, item.stock);
    }
  }

  return [...bySymbol.values()];
}

function SnapshotEmptyState({ title }: { title: string }) {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
          Chưa có snapshot. Dữ liệu sẽ xuất hiện sau lần đồng bộ snapshot tiếp theo.
        </p>
      </div>
    </section>
  );
}
