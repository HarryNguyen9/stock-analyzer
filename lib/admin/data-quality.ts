import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type DataQualityJob = {
  id: string;
  jobType: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  selectedCount: number;
  successCount: number;
  failedCount: number;
  errorMessage: string | null;
};

export type DataQualitySnapshot = {
  generatedAt: string;
  totalSymbols: number;
  activeSymbols: number;
  inactiveSymbols: number;
  inactiveUnsupportedSymbols: number;
  symbolsWithNoPriceData: number;
  symbolsWithLessThan20Candles: number;
  symbolsWithAtLeast20Candles: number;
  failedSymbols: number;
  unsupportedSymbols: number;
  latestSnapshotUpdatedAt: string | null;
  latestJobs: {
    syncPrices: DataQualityJob | null;
    backfillMissingPrices: DataQualityJob | null;
    refreshUniverse: DataQualityJob | null;
    syncSymbolMetadata: DataQualityJob | null;
  };
};

type SymbolRow = {
  symbol: string;
  is_active: boolean | null;
  sync_status: string | null;
  unsupported_at: string | null;
};

type PriceSymbolRow = {
  symbol: string;
};

type JobRow = {
  id: string;
  job_type: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  selected_count: number | null;
  success_count: number | null;
  failed_count: number | null;
  error_message: string | null;
};

type SnapshotRow = {
  updated_at: string | null;
};

const PRICE_PAGE_SIZE = 1_000;
const MAX_PRICE_ROWS_TO_SCAN = 500_000;

export async function getDataQualitySnapshot(): Promise<DataQualitySnapshot> {
  const supabase = createSupabaseAdminClient();
  const [symbols, priceCounts, latestJobs, latestSnapshotUpdatedAt] = await Promise.all([
    readSymbols(),
    readPriceCounts(),
    readLatestJobs(),
    readLatestSnapshotUpdatedAt(),
  ]);

  let activeSymbols = 0;
  let inactiveSymbols = 0;
  let inactiveUnsupportedSymbols = 0;
  let failedSymbols = 0;
  let unsupportedSymbols = 0;
  let symbolsWithNoPriceData = 0;
  let symbolsWithLessThan20Candles = 0;
  let symbolsWithAtLeast20Candles = 0;

  for (const symbol of symbols) {
    const priceCount = priceCounts.get(symbol.symbol) ?? 0;
    const isUnsupported = symbol.sync_status === "unsupported" || Boolean(symbol.unsupported_at);

    if (symbol.is_active === false) {
      inactiveSymbols += 1;
    } else {
      activeSymbols += 1;
    }

    if (symbol.is_active === false && isUnsupported) {
      inactiveUnsupportedSymbols += 1;
    }

    if (symbol.sync_status === "failed" || symbol.sync_status === "backfill_failed") {
      failedSymbols += 1;
    }

    if (isUnsupported) {
      unsupportedSymbols += 1;
    }

    if (priceCount === 0) {
      symbolsWithNoPriceData += 1;
    } else if (priceCount < 20) {
      symbolsWithLessThan20Candles += 1;
    } else {
      symbolsWithAtLeast20Candles += 1;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    totalSymbols: symbols.length,
    activeSymbols,
    inactiveSymbols,
    inactiveUnsupportedSymbols,
    symbolsWithNoPriceData,
    symbolsWithLessThan20Candles,
    symbolsWithAtLeast20Candles,
    failedSymbols,
    unsupportedSymbols,
    latestSnapshotUpdatedAt,
    latestJobs,
  };

  async function readSymbols(): Promise<SymbolRow[]> {
    const { data, error } = await supabase
      .from("symbols")
      .select("symbol,is_active,sync_status,unsupported_at")
      .order("symbol", { ascending: true })
      .limit(3000);

    if (error) {
      throw error;
    }

    return (data ?? []) as unknown as SymbolRow[];
  }

  async function readPriceCounts(): Promise<Map<string, number>> {
    const counts = new Map<string, number>();

    for (let from = 0; from < MAX_PRICE_ROWS_TO_SCAN; from += PRICE_PAGE_SIZE) {
      const { data, error } = await supabase
        .from("stock_prices")
        .select("symbol")
        .range(from, from + PRICE_PAGE_SIZE - 1);

      if (error) {
        throw error;
      }

      const rows = (data ?? []) as unknown as PriceSymbolRow[];

      for (const row of rows) {
        counts.set(row.symbol, (counts.get(row.symbol) ?? 0) + 1);
      }

      if (rows.length < PRICE_PAGE_SIZE) {
        break;
      }
    }

    return counts;
  }

  async function readLatestJobs(): Promise<DataQualitySnapshot["latestJobs"]> {
    const [syncPrices, backfillMissingPrices, refreshUniverse, syncSymbolMetadata] = await Promise.all([
      readLatestJob("sync-prices"),
      readLatestJob("backfill_missing_prices"),
      readLatestJob("refresh_universe"),
      readLatestJob("sync_symbol_metadata"),
    ]);

    return {
      syncPrices,
      backfillMissingPrices,
      refreshUniverse,
      syncSymbolMetadata,
    };
  }

  async function readLatestJob(jobType: string): Promise<DataQualityJob | null> {
    const { data, error } = await supabase
      .from("sync_jobs")
      .select("id,job_type,status,started_at,finished_at,duration_ms,selected_count,success_count,failed_count,error_message")
      .eq("job_type", jobType)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const row = data as unknown as JobRow;
    return {
      id: row.id,
      jobType: row.job_type,
      status: row.status,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      durationMs: row.duration_ms,
      selectedCount: row.selected_count ?? 0,
      successCount: row.success_count ?? 0,
      failedCount: row.failed_count ?? 0,
      errorMessage: row.error_message,
    };
  }

  async function readLatestSnapshotUpdatedAt(): Promise<string | null> {
    const { data, error } = await supabase
      .from("market_snapshots")
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return ((data as unknown as SnapshotRow).updated_at) ?? null;
  }
}

export function isAdminToolsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_ADMIN_TOOLS === "true";
}
