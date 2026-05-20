import { getSymbolsMissingPriceData } from "@/lib/data-source/missing-prices";
import { DEFAULT_HISTORICAL_CANDLE_LIMIT, TARGET_STOCK_PRICE_CANDLES } from "@/lib/data-source/constants";
import { classifyProviderFailure } from "@/lib/data-source/provider-errors";
import { BACKFILL_PRICE_PIPELINE, markSymbolUnsupported, syncSingleSymbolToSupabase } from "@/lib/pipeline/price-sync";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type BackfillResponse =
  | {
      ok: true;
      jobId: string | null;
      pipeline: typeof BACKFILL_PRICE_PIPELINE.pipeline;
      responsibility: typeof BACKFILL_PRICE_PIPELINE.responsibility;
      source: typeof BACKFILL_PRICE_PIPELINE.source;
      limit: number;
      maxLimit: number;
      limitClamped: boolean;
      candleLimit: number;
      targetCandles: number;
      symbolsBelowTarget: number;
      selected: number;
      synced: number;
      failed: number;
      diagnostics: BackfillSymbolDiagnostic[];
      failedSymbols: BackfillFailedSymbol[];
      failedTemporary: BackfillFailedSymbol[];
      failedUnsupported: BackfillFailedSymbol[];
      sampleSyncedSymbols: string[];
      remainingMissing: number;
      stoppedEarly: boolean;
      stopReason: "time_guard" | null;
      durationMs: number;
    }
  | {
      ok: false;
      jobId?: string | null;
      message: string;
      pipeline: typeof BACKFILL_PRICE_PIPELINE.pipeline;
      responsibility: typeof BACKFILL_PRICE_PIPELINE.responsibility;
      source: typeof BACKFILL_PRICE_PIPELINE.source;
      stack?: string;
    };

type SyncJobInsert = Database["public"]["Tables"]["sync_jobs"]["Insert"];
type SyncJobUpdate = Database["public"]["Tables"]["sync_jobs"]["Update"];
type BackfillFailedSymbol = { symbol: string; error: string };
type BackfillSymbolDiagnostic = {
  symbol: string;
  existingRows: number;
  fetchedCandles: number;
  upsertedCandles: number;
};

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;
const RETRIES = 1;
const SOFT_TIME_LIMIT_MS = 240_000;

export async function GET(request: Request) {
  return handleBackfillMissingPrices(request);
}

export async function POST(request: Request) {
  return handleBackfillMissingPrices(request);
}

async function handleBackfillMissingPrices(request: Request): Promise<Response> {
  const startedAt = Date.now();
  let jobId: string | null = null;

  try {
    const secret = process.env.CRON_SECRET;

    if (!secret) {
      throw new Error("CRON_SECRET chua duoc cau hinh.");
    }

    if (request.headers.get("authorization") !== `Bearer ${secret}`) {
      return jsonError(new Error("Khong co quyen chay backfill missing prices."), 401, jobId);
    }

    const limitParam = getClampedNumberParam(request, "limit", DEFAULT_LIMIT, 1, MAX_LIMIT);
    const limit = limitParam.value;
    const missingSymbols = await getSymbolsMissingPriceData({ limit });
    const symbolsBelowTarget = missingSymbols.filter((item) => item.priceRows < TARGET_STOCK_PRICE_CANDLES).length;
    const processedSymbols: Array<{ symbol: string; status: "synced" | "failed"; message?: string }> = [];
    jobId = await createSyncJob({
      ...BACKFILL_PRICE_PIPELINE,
      trigger: "backfill-missing-prices-route",
      method: request.method,
      limit,
      maxLimit: MAX_LIMIT,
      limitClamped: limitParam.clamped,
      candleLimit: DEFAULT_HISTORICAL_CANDLE_LIMIT,
      targetCandles: TARGET_STOCK_PRICE_CANDLES,
      symbolsBelowTarget,
      selectedSymbols: missingSymbols.map((item) => item.symbol),
    });

    let synced = 0;
    let failed = 0;
    let stoppedEarly = false;
    const failedSymbols: BackfillFailedSymbol[] = [];
    const failedTemporary: BackfillFailedSymbol[] = [];
    const failedUnsupported: BackfillFailedSymbol[] = [];
    const sampleSyncedSymbols: string[] = [];
    const diagnostics: BackfillSymbolDiagnostic[] = [];

    for (const item of missingSymbols) {
      if (Date.now() - startedAt >= SOFT_TIME_LIMIT_MS) {
        stoppedEarly = true;
        break;
      }

      try {
        const result = await syncWithRetry(item.symbol);
        synced += 1;
        diagnostics.push({
          symbol: item.symbol,
          existingRows: result.existingRows,
          fetchedCandles: result.fetchedCandles,
          upsertedCandles: result.upsertedCandles,
        });
        if (sampleSyncedSymbols.length < 10) {
          sampleSyncedSymbols.push(item.symbol);
        }
        processedSymbols.push({ symbol: item.symbol, status: "synced" });
      } catch (error) {
        const failure = classifyProviderFailure(error);
        const message = failure.message;
        failed += 1;
        failedSymbols.push({
          symbol: item.symbol,
          error: message,
        });

        if (failure.kind === "unsupported") {
          failedUnsupported.push({ symbol: item.symbol, error: message });
          await markSymbolUnsupported(item.symbol, message);
        } else {
          failedTemporary.push({ symbol: item.symbol, error: message });
          await markBackfillFailed(item.symbol, message);
        }

        processedSymbols.push({
          symbol: item.symbol,
          status: "failed",
          message,
        });
      }
    }

    const remainingMissing = (await getSymbolsMissingPriceData({ limit: 10_000 })).length;
    const durationMs = Date.now() - startedAt;

    await updateSyncJob(jobId, {
      status: failed > 0 && synced === 0 ? "failed" : "success",
      finished_at: new Date().toISOString(),
      duration_ms: durationMs,
      selected_count: missingSymbols.length,
      success_count: synced,
      failed_count: failed,
      error_message: failed > 0 && synced === 0 ? "Backfill failed for all selected symbols." : null,
      metadata: {
        ...BACKFILL_PRICE_PIPELINE,
        remainingMissing,
        processedSymbols,
        failedSymbols,
        failedTemporary,
        failedUnsupported,
        sampleSyncedSymbols,
        diagnostics,
        candleLimit: DEFAULT_HISTORICAL_CANDLE_LIMIT,
        targetCandles: TARGET_STOCK_PRICE_CANDLES,
        symbolsBelowTarget,
        stoppedEarly,
        stopReason: stoppedEarly ? "time_guard" : null,
      },
    });

    return Response.json({
      ok: true,
      jobId,
      ...BACKFILL_PRICE_PIPELINE,
      limit,
      maxLimit: MAX_LIMIT,
      limitClamped: limitParam.clamped,
      candleLimit: DEFAULT_HISTORICAL_CANDLE_LIMIT,
      targetCandles: TARGET_STOCK_PRICE_CANDLES,
      symbolsBelowTarget,
      selected: missingSymbols.length,
      synced,
      failed,
      diagnostics,
      failedSymbols,
      failedTemporary,
      failedUnsupported,
      sampleSyncedSymbols,
      remainingMissing,
      stoppedEarly,
      stopReason: stoppedEarly ? "time_guard" : null,
      durationMs,
    } satisfies BackfillResponse);
  } catch (error) {
    console.error("Backfill missing prices failed:", error);
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

async function syncWithRetry(symbol: string) {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    try {
      return await syncSingleSymbolToSupabase(symbol, {
        skipIfFetchedOlderThanExisting: true,
        candleLimit: DEFAULT_HISTORICAL_CANDLE_LIMIT,
      });
    } catch (error) {
      lastError = error;

      if (attempt < RETRIES) {
        await delay(1_000 * (attempt + 1));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function markBackfillFailed(symbol: string, errorMessage: string) {
  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("symbols")
      .update({
        sync_status: "backfill_failed",
        last_error: errorMessage,
      })
      .eq("symbol", symbol);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.warn(`${symbol}: khong cap nhat duoc backfill_failed (${getShortErrorMessage(error)})`);
  }
}

function getShortErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, " ").trim().slice(0, 220) || "Unknown backfill error";
}

function getNumberParam(request: Request, key: string, fallback: number, min: number, max: number): number {
  const value = new URL(request.url).searchParams.get(key);

  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min ? Math.min(parsed, max) : fallback;
}

function getClampedNumberParam(
  request: Request,
  key: string,
  fallback: number,
  min: number,
  max: number,
): { value: number; clamped: boolean } {
  const value = new URL(request.url).searchParams.get(key);

  if (!value) {
    return { value: fallback, clamped: false };
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < min) {
    return { value: fallback, clamped: false };
  }

  return {
    value: Math.min(parsed, max),
    clamped: parsed > max,
  };
}

async function createSyncJob(metadata: Json): Promise<string | null> {
  try {
    const supabase = createSupabaseAdminClient();
    const row: SyncJobInsert = {
      job_type: "backfill_missing_prices",
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
    console.warn("Khong ghi duoc sync_jobs backfill_missing_prices running:", error);
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
    console.warn("Khong update duoc sync_jobs backfill_missing_prices:", error);
  }
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function jsonError(error: unknown, status: number, jobId: string | null = null): Response {
  const message = error instanceof Error ? error.message : "Backfill missing prices that bai.";
  const stack = error instanceof Error ? error.stack : undefined;

  return Response.json(
    {
      ok: false,
      jobId,
      message,
      ...BACKFILL_PRICE_PIPELINE,
      ...(process.env.NODE_ENV !== "production" && stack ? { stack } : {}),
    } satisfies BackfillResponse,
    { status },
  );
}
