import { DataStatusPanel } from "@/components/DataStatusPanel";
import { MarketScanner } from "@/components/MarketScanner";
import { MarketBreadth } from "@/components/MarketBreadth";
import { MarketAlerts } from "@/components/MarketAlerts";
import { HomeTabs } from "@/components/HomeTabs";
import { SectorHeatmap } from "@/components/SectorHeatmap";
import { ThemeToggle } from "@/components/ThemeToggle";
import { vi } from "@/lib/i18n/vi";
import { getDataFreshness } from "@/lib/data-source/prices";
import type { DataFreshnessResult } from "@/lib/data-source/provider";
import { readHomeScannerSnapshot } from "@/lib/scanner/snapshot";
import {
  readMarketAlertsSnapshot,
  readMarketBreadthSnapshot,
  readSectorHeatmapSnapshot,
} from "@/lib/pipeline/snapshot";

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string | string[] }>;
}) {
  const query = await searchParams;
  const initialTab = getInitialTab(query?.tab);
  const emptyFreshness: DataFreshnessResult = { status: "empty", updatedAt: null };
  const [dataFreshness, mergedScannerSnapshot, sectorHeatmap, marketBreadth, marketAlerts] = await Promise.all([
    timedSnapshot("dataFreshness", getDataFreshness(), emptyFreshness),
    timedSnapshot("home_scanner", readHomeScannerSnapshot(), null),
    timedSnapshot("sector_heatmap", readSectorHeatmapSnapshot(), []),
    timedSnapshot("market_breadth", readMarketBreadthSnapshot(), null),
    timedSnapshot("market_alerts", readMarketAlertsSnapshot(), []),
  ]);
  const scannerStocks = getUniqueScannerStocks(mergedScannerSnapshot);
  const averageScore =
    scannerStocks.length > 0
      ? Math.round(scannerStocks.reduce((total, stock) => total + stock.score, 0) / scannerStocks.length)
      : 0;
  const positiveCount = marketBreadth?.advancers ?? 0;
  const totalBreadthSymbols = marketBreadth?.totalSymbols ?? 0;

  return (
    <main className="min-h-screen">
      <section className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <DataStatusPanel initialFreshness={dataFreshness} />
            <div className="flex items-start justify-between gap-3 sm:flex-col sm:items-end">
              <ThemeToggle />
            </div>
          </div>

          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-normal text-emerald-700 dark:text-emerald-400">
                {vi.home.eyebrow}
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-normal text-slate-950 dark:text-white sm:text-5xl">
                {vi.home.title}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-400">
                {vi.home.description}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:w-80">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-sm text-slate-500 dark:text-slate-400">{vi.home.averageScore}</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">{averageScore}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-sm text-slate-500 dark:text-slate-400">{vi.home.greenToday}</p>
                <p className="mt-2 text-3xl font-semibold text-emerald-700 dark:text-emerald-400">
                  {positiveCount}/{totalBreadthSymbols}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <HomeTabs
        initialTab={initialTab}
        discover={
          <>
            <MarketScanner stocks={[]} snapshotGroups={mergedScannerSnapshot} />
            <MarketAlerts alerts={marketAlerts} />
            {marketBreadth ? <MarketBreadth breadth={marketBreadth} /> : <SnapshotEmptyState title="Độ rộng thị trường" />}
            <SectorHeatmap sectors={sectorHeatmap} />
          </>
        }
      />
    </main>
  );
}

function getInitialTab(tab: string | string[] | undefined): "discover" | "search" {
  const value = Array.isArray(tab) ? tab[0] : tab;
  return value === "search" ? "search" : "discover";
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
