import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

export const UNIVERSE_RANKING_PIPELINE = {
  pipeline: "refresh-universe",
  responsibility: "Update liquidity_rank, tier and auto_sync from existing stock_prices only.",
  source: "supabase-stock-prices",
} as const;

type SymbolRow = Pick<Database["public"]["Tables"]["symbols"]["Row"], "symbol">;
type PriceRow = Pick<
  Database["public"]["Tables"]["stock_prices"]["Row"],
  "symbol" | "date" | "close" | "volume"
>;
type SymbolUpdate = Pick<
  Database["public"]["Tables"]["symbols"]["Update"],
  "liquidity_rank" | "tier" | "auto_sync"
>;

type LiquidityMetric = {
  symbol: string;
  avgVolume20: number;
  avgTradedValue20: number;
  activeDays20: number;
  priceRows: number;
  latestClose: number | null;
  liquidityScore: number;
  eligible: boolean;
  exclusionReason: string | null;
  score: number;
};

export type RefreshUniverseResult = Awaited<ReturnType<typeof refreshUniverseRankings>>;

const PRICE_SCAN_LIMIT = 50_000;
const PRICE_PAGE_SIZE = 1_000;
const SYMBOL_PAGE_SIZE = 1_000;
const UPDATE_CONCURRENCY = 25;
const MIN_ACTIVE_DAYS_20 = 10;
const MIN_PRICE_ROWS_20 = 20;
const PRICE_UNIT_MULTIPLIER = 1_000;

export const RANKING_RULES = {
  lookbackSessions: 20,
  minActiveDays20: MIN_ACTIVE_DAYS_20,
  minLatestClose: "> 0",
  minPriceRows20: MIN_PRICE_ROWS_20,
  priceUnitMultiplier: PRICE_UNIT_MULTIPLIER,
  scoreWeights: {
    avgTradedValue20: "primary",
    activeDays20: "quality multiplier",
    avgVolume20: "secondary",
  },
};

export async function refreshUniverseRankings() {
  const supabase = createSupabaseAdminClient();
  const [symbols, prices] = await Promise.all([readSymbols(), readRecentPrices()]);
  const symbolSet = new Set(symbols.map((row) => row.symbol));
  const allMetrics = calculateLiquidityMetrics(prices).filter((metric) => symbolSet.has(metric.symbol));
  const eligibleMetrics = allMetrics.filter((metric) => metric.eligible);
  const metricBySymbol = new Map(eligibleMetrics.map((metric, index) => [metric.symbol, { metric, rank: index + 1 }]));
  const missingPriceSymbols = symbols.length - allMetrics.length;
  const excludedReasons = countExcludedReasons(allMetrics);
  const diagnostics = createDiagnostics({
    symbolsCount: symbols.length,
    allMetrics,
    eligibleMetrics,
    missingPriceSymbols,
    excludedReasons,
  });
  const warning = eligibleMetrics.length === 0
    ? "Not enough eligible symbols to safely refresh universe"
    : undefined;

  let updated = 0;
  let failed = 0;
  let topA = 0;
  let topB = 0;
  let topC = 0;

  if (eligibleMetrics.length === 0) {
    return {
      selected: symbols.length,
      updated: 0,
      failed: 0,
      ranked: allMetrics.length,
      eligible: 0,
      excluded: symbols.length,
      topA: 0,
      topB: 0,
      topC: 0,
      warning,
      diagnostics,
    };
  }

  for (let index = 0; index < eligibleMetrics.length; index += UPDATE_CONCURRENCY) {
    const batch = eligibleMetrics.slice(index, index + UPDATE_CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map(async (metric) => {
        const ranked = metricBySymbol.get(metric.symbol);
        const tier = getTier(ranked?.rank ?? null);
        const update: SymbolUpdate = {
          liquidity_rank: ranked?.rank ?? null,
          tier,
          auto_sync: tier === "A",
        };
        const { error } = await supabase.from("symbols").update(update).eq("symbol", metric.symbol);

        if (error) {
          throw error;
        }

        if (tier === "A") topA += 1;
        else if (tier === "B") topB += 1;
        else topC += 1;
      }),
    );

    for (const item of settled) {
      if (item.status === "fulfilled") {
        updated += 1;
      } else {
        failed += 1;
      }
    }
  }

  return {
    selected: symbols.length,
    updated,
    failed,
    ranked: allMetrics.length,
    eligible: eligibleMetrics.length,
    excluded: Math.max(0, symbols.length - eligibleMetrics.length),
    warning,
    diagnostics,
    topA,
    topB,
    topC,
  };
}

async function readSymbols(): Promise<SymbolRow[]> {
  const supabase = createSupabaseAdminClient();
  const rows: SymbolRow[] = [];

  for (let from = 0; ; from += SYMBOL_PAGE_SIZE) {
    const to = from + SYMBOL_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("symbols")
      .select("symbol")
      .order("symbol", { ascending: true })
      .range(from, to);

    if (error) {
      throw error;
    }

    rows.push(...((data ?? []) as SymbolRow[]));

    if (!data || data.length < SYMBOL_PAGE_SIZE) {
      break;
    }
  }

  return rows.map((row) => ({
    symbol: row.symbol.toUpperCase(),
  }));
}

async function readRecentPrices(): Promise<PriceRow[]> {
  const supabase = createSupabaseAdminClient();
  const rows: PriceRow[] = [];

  for (let from = 0; from < PRICE_SCAN_LIMIT; from += PRICE_PAGE_SIZE) {
    const to = Math.min(from + PRICE_PAGE_SIZE - 1, PRICE_SCAN_LIMIT - 1);
    const { data, error } = await supabase
      .from("stock_prices")
      .select("symbol,date,close,volume")
      .order("date", { ascending: false })
      .range(from, to);

    if (error) {
      throw error;
    }

    rows.push(...((data ?? []) as PriceRow[]));

    if (!data || data.length < PRICE_PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

function calculateLiquidityMetrics(prices: PriceRow[]): LiquidityMetric[] {
  const grouped = new Map<string, PriceRow[]>();

  for (const row of prices) {
    const symbol = row.symbol.toUpperCase();
    const rows = grouped.get(symbol) ?? [];

    if (rows.length < 20) {
      rows.push(row);
      grouped.set(symbol, rows);
    }
  }

  return Array.from(grouped.entries())
    .map(([symbol, rows]) => {
      const sortedRows = [...rows].sort((a, b) => b.date.localeCompare(a.date));
      const latest = sortedRows[0] ?? null;
      const activeRows = rows.filter((row) => Number(row.volume) > 0);
      const avgVolume20 = average(rows.map((row) => Number(row.volume)));
      const avgTradedValue20 = average(
        rows.map((row) => Number(row.close) * PRICE_UNIT_MULTIPLIER * Number(row.volume)),
      );
      const activeDays20 = activeRows.length;
      const latestClose = latest ? Number(latest.close) : null;
      const exclusionReason = getExclusionReason({
        activeDays20,
        avgTradedValue20,
        latestClose,
        priceRows: rows.length,
      });
      const activeQuality = Math.min(1, activeDays20 / 20);
      const valueScore = Math.log10(Math.max(1, avgTradedValue20));
      const volumeScore = Math.log10(Math.max(1, avgVolume20));
      const liquidityScore = exclusionReason
        ? 0
        : valueScore * 100 * activeQuality + volumeScore * 8;

      return {
        symbol,
        avgVolume20,
        avgTradedValue20,
        activeDays20,
        priceRows: rows.length,
        latestClose,
        liquidityScore,
        eligible: exclusionReason === null,
        exclusionReason,
        score: liquidityScore,
      };
    })
    .sort(
      (a, b) =>
        Number(b.eligible) - Number(a.eligible) ||
        b.liquidityScore - a.liquidityScore ||
        b.avgTradedValue20 - a.avgTradedValue20 ||
        b.activeDays20 - a.activeDays20 ||
        b.avgVolume20 - a.avgVolume20 ||
        a.symbol.localeCompare(b.symbol),
    );
}

function getExclusionReason(input: {
  activeDays20: number;
  avgTradedValue20: number;
  latestClose: number | null;
  priceRows: number;
}): string | null {
  if (input.priceRows === 0 || input.latestClose === null || !Number.isFinite(input.latestClose)) {
    return "missing-price-data";
  }

  if (input.priceRows < MIN_PRICE_ROWS_20) {
    return "insufficient-price-rows";
  }

  if (input.activeDays20 < MIN_ACTIVE_DAYS_20) {
    return "low-active-days";
  }

  if (input.avgTradedValue20 <= 0) {
    return "invalid-traded-value";
  }

  if (input.latestClose <= 0) {
    return "low-latest-close";
  }

  return null;
}

function countExcludedReasons(metrics: LiquidityMetric[]): Record<string, number> {
  return metrics.reduce<Record<string, number>>((counts, metric) => {
    if (!metric.exclusionReason) {
      return counts;
    }

    counts[metric.exclusionReason] = (counts[metric.exclusionReason] ?? 0) + 1;
    return counts;
  }, {});
}

function createDiagnostics(input: {
  symbolsCount: number;
  allMetrics: LiquidityMetric[];
  eligibleMetrics: LiquidityMetric[];
  missingPriceSymbols: number;
  excludedReasons: Record<string, number>;
}) {
  const values = input.allMetrics.map((metric) => metric.avgTradedValue20).filter(Number.isFinite);
  const excludedMetrics = input.allMetrics.filter((metric) => !metric.eligible);

  return {
    totalSymbols: input.symbolsCount,
    withPrices: input.allMetrics.length,
    eligible: input.eligibleMetrics.length,
    excluded: Math.max(0, input.symbolsCount - input.eligibleMetrics.length),
    skippedDueToMissingPrices: input.missingPriceSymbols,
    excludedReasons: input.excludedReasons,
    avgTradedValue20: {
      sample: values.slice(0, 5),
      min: values.length > 0 ? Math.min(...values) : 0,
      max: values.length > 0 ? Math.max(...values) : 0,
    },
    sampleEligibleSymbols: input.eligibleMetrics.slice(0, 5).map((metric) => ({
      symbol: metric.symbol,
      avgTradedValue20: metric.avgTradedValue20,
      activeDays20: metric.activeDays20,
      latestClose: metric.latestClose,
    })),
    sampleExcludedSymbols: excludedMetrics.slice(0, 5).map((metric) => ({
      symbol: metric.symbol,
      reason: metric.exclusionReason,
      avgTradedValue20: metric.avgTradedValue20,
      activeDays20: metric.activeDays20,
      latestClose: metric.latestClose,
      priceRows: metric.priceRows,
    })),
  };
}

function average(values: number[]): number {
  const validValues = values.filter(Number.isFinite);

  if (validValues.length === 0) {
    return 0;
  }

  return validValues.reduce((total, value) => total + value, 0) / validValues.length;
}

function getTier(rank: number | null): "A" | "B" | "C" {
  if (rank !== null && rank <= 300) {
    return "A";
  }

  if (rank !== null && rank <= 600) {
    return "B";
  }

  return "C";
}
