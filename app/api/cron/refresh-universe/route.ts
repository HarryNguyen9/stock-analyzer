import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SymbolRow = Pick<Database["public"]["Tables"]["symbols"]["Row"], "symbol">;
type PriceRow = Pick<
  Database["public"]["Tables"]["stock_prices"]["Row"],
  "symbol" | "date" | "close" | "volume"
>;
type SymbolUpdate = Database["public"]["Tables"]["symbols"]["Update"];
type SyncJobInsert = Database["public"]["Tables"]["sync_jobs"]["Insert"];
type SyncJobUpdate = Database["public"]["Tables"]["sync_jobs"]["Update"];

type LiquidityMetric = {
  symbol: string;
  avgVolume20: number;
  avgTradedValue20: number;
  tradedDays20: number;
  score: number;
};

type UniverseResponse =
  | {
      ok: true;
      jobId: string | null;
      selected: number;
      updated: number;
      topA: number;
      topB: number;
      topC: number;
      durationMs: number;
    }
  | {
      ok: false;
      jobId?: string | null;
      message: string;
      stack?: string;
    };

const PRICE_SCAN_LIMIT = 50_000;
const PRICE_PAGE_SIZE = 1_000;
const SYMBOL_PAGE_SIZE = 1_000;
const UPDATE_CONCURRENCY = 25;

export async function GET(request: Request) {
  return handleRefreshUniverse(request);
}

export async function POST(request: Request) {
  return handleRefreshUniverse(request);
}

async function handleRefreshUniverse(request: Request): Promise<Response> {
  const startedAt = Date.now();
  let jobId: string | null = null;

  try {
    const secret = process.env.CRON_SECRET;

    if (!secret) {
      throw new Error("CRON_SECRET chua duoc cau hinh.");
    }

    if (request.headers.get("authorization") !== `Bearer ${secret}`) {
      return jsonError(new Error("Khong co quyen chay refresh universe."), 401, jobId);
    }

    jobId = await createSyncJob({
      trigger: "refresh-universe-route",
      method: request.method,
      priceScanLimit: PRICE_SCAN_LIMIT,
    });

    const result = await refreshUniverseRankings();
    const durationMs = Date.now() - startedAt;

    await updateSyncJob(jobId, {
      status: "success",
      finished_at: new Date().toISOString(),
      duration_ms: durationMs,
      selected_count: result.selected,
      success_count: result.updated,
      failed_count: result.failed,
      metadata: {
        topA: result.topA,
        topB: result.topB,
        topC: result.topC,
        ranked: result.ranked,
      },
    });

    return Response.json({
      ok: true,
      jobId,
      selected: result.selected,
      updated: result.updated,
      topA: result.topA,
      topB: result.topB,
      topC: result.topC,
      durationMs,
    } satisfies UniverseResponse);
  } catch (error) {
    console.error("Refresh universe failed:", error);
    const durationMs = Date.now() - startedAt;

    await updateSyncJob(jobId, {
      status: "failed",
      finished_at: new Date().toISOString(),
      duration_ms: durationMs,
      error_message: error instanceof Error ? error.message : String(error),
    });

    return jsonError(error, 500, jobId);
  }
}

async function refreshUniverseRankings() {
  const supabase = createSupabaseAdminClient();
  const [symbols, prices] = await Promise.all([readSymbols(), readRecentPrices()]);
  const symbolSet = new Set(symbols.map((row) => row.symbol));
  const metrics = calculateLiquidityMetrics(prices).filter((metric) => symbolSet.has(metric.symbol));
  const metricBySymbol = new Map(metrics.map((metric, index) => [metric.symbol, { metric, rank: index + 1 }]));

  let updated = 0;
  let failed = 0;
  let topA = 0;
  let topB = 0;
  let topC = 0;

  for (let index = 0; index < symbols.length; index += UPDATE_CONCURRENCY) {
    const batch = symbols.slice(index, index + UPDATE_CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map(async (row) => {
        const ranked = metricBySymbol.get(row.symbol);
        const tier = getTier(ranked?.rank ?? null);
        const update: SymbolUpdate = {
          liquidity_rank: ranked?.rank ?? null,
          tier,
          auto_sync: tier === "A",
        };
        const { error } = await supabase.from("symbols").update(update).eq("symbol", row.symbol);

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
    ranked: metrics.length,
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
      const tradedRows = rows.filter((row) => Number(row.volume) > 0);
      const avgVolume20 = average(rows.map((row) => Number(row.volume)));
      const avgTradedValue20 = average(rows.map((row) => Number(row.close) * Number(row.volume)));
      const tradedDays20 = tradedRows.length;

      return {
        symbol,
        avgVolume20,
        avgTradedValue20,
        tradedDays20,
        score: avgTradedValue20 * Math.max(0.2, tradedDays20 / 20),
      };
    })
    .filter((metric) => metric.tradedDays20 > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.avgTradedValue20 - a.avgTradedValue20 ||
        b.avgVolume20 - a.avgVolume20 ||
        a.symbol.localeCompare(b.symbol),
    );
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

async function createSyncJob(metadata: Json): Promise<string | null> {
  try {
    const supabase = createSupabaseAdminClient();
    const row: SyncJobInsert = {
      job_type: "refresh_universe",
      status: "running",
      started_at: new Date().toISOString(),
      metadata,
    };
    const { data, error } = await supabase.from("sync_jobs").insert(row).select("id").single();

    if (error) {
      throw error;
    }

    return typeof data?.id === "string" ? data.id : null;
  } catch (error) {
    console.warn("Khong ghi duoc sync_jobs refresh_universe running:", error);
    return null;
  }
}

async function updateSyncJob(jobId: string | null, update: SyncJobUpdate) {
  if (!jobId) {
    return;
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("sync_jobs").update(update).eq("id", jobId);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.warn("Khong update duoc sync_jobs refresh_universe:", error);
  }
}

function jsonError(error: unknown, status: number, jobId: string | null = null): Response {
  const message = error instanceof Error ? error.message : "Refresh universe that bai.";
  const stack = error instanceof Error ? error.stack : undefined;

  return Response.json(
    {
      ok: false,
      jobId,
      message,
      ...(process.env.NODE_ENV !== "production" && stack ? { stack } : {}),
    } satisfies UniverseResponse,
    { status },
  );
}
