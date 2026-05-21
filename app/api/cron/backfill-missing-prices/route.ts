import { getSymbolsMissingPriceData } from "@/lib/data-source/missing-prices";
import { DEFAULT_BACKFILL_TARGET_CANDLES, getLookbackDaysForCandles } from "@/lib/data-source/constants";
import { classifyProviderFailure, serializeProviderError } from "@/lib/data-source/provider-errors";
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
  targetCandles: number;
  lookbackDays: number;
  startDate: string;
  endDate: string;
  existingRowsBefore: number;
  fetchedCandles: number;
  upsertedCandles: number;
  rowsAfter: number;
  providerUsed: string;
  providerReturnedOnly: number | null;
  providerLimitReached: boolean;
  partialBackfill: boolean;
  providerDiagnostics?: Json;
  errorMessage?: string;
  errorName?: string;
  errorStack?: string;
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
    const targetCandles = getNumberParam(request, "targetCandles", DEFAULT_BACKFILL_TARGET_CANDLES, 20, DEFAULT_BACKFILL_TARGET_CANDLES);
    const fetchWindow = getBackfillFetchWindow(targetCandles);
    const missingSymbols = await getSymbolsMissingPriceData({ limit, targetCandles });
    const symbolsBelowTarget = missingSymbols.filter((item) => item.priceRows < targetCandles).length;
    const processedSymbols: Array<{ symbol: string; status: "synced" | "failed"; message?: string }> = [];
    jobId = await createSyncJob({
      ...BACKFILL_PRICE_PIPELINE,
      trigger: "backfill-missing-prices-route",
      method: request.method,
      limit,
      maxLimit: MAX_LIMIT,
      limitClamped: limitParam.clamped,
      candleLimit: targetCandles,
      targetCandles,
      lookbackDays: fetchWindow.lookbackDays,
      startDate: fetchWindow.startDate,
      endDate: fetchWindow.endDate,
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
        const result = await syncWithRetry(item.symbol, targetCandles);
        synced += 1;
        diagnostics.push({
          symbol: item.symbol,
          targetCandles,
          lookbackDays: result.lookbackDays,
          startDate: result.startDate,
          endDate: result.endDate,
          existingRowsBefore: result.existingRows,
          fetchedCandles: result.fetchedCandles,
          upsertedCandles: result.upsertedCandles,
          rowsAfter: result.rowsAfter,
          providerUsed: result.providerUsed,
          providerReturnedOnly: result.providerReturnedOnly,
          providerLimitReached: result.providerLimitReached,
          partialBackfill: result.partialBackfill,
        });
        if (sampleSyncedSymbols.length < 10) {
          sampleSyncedSymbols.push(item.symbol);
        }
        processedSymbols.push({ symbol: item.symbol, status: "synced" });
      } catch (error) {
        const serializedError = serializeBackfillError(error);
        const failure = classifyProviderFailure(serializedError.errorMessage);
        const message = serializedError.errorMessage;
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
        diagnostics.push({
          symbol: item.symbol,
          targetCandles,
          lookbackDays: fetchWindow.lookbackDays,
          startDate: fetchWindow.startDate,
          endDate: fetchWindow.endDate,
          existingRowsBefore: item.priceRows,
          fetchedCandles: 0,
          upsertedCandles: 0,
          rowsAfter: item.priceRows,
          providerUsed: "vnstock",
          providerReturnedOnly: null,
          providerLimitReached: false,
          partialBackfill: false,
          providerDiagnostics: serializedError.providerDiagnostics,
          errorMessage: message,
          errorName: serializedError.errorName,
          ...(serializedError.errorStack ? { errorStack: serializedError.errorStack } : {}),
        });
      }
    }

    const remainingMissing = (await getSymbolsMissingPriceData({ limit: 10_000, targetCandles })).length;
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
        candleLimit: targetCandles,
        targetCandles,
        lookbackDays: fetchWindow.lookbackDays,
        startDate: fetchWindow.startDate,
        endDate: fetchWindow.endDate,
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
      candleLimit: targetCandles,
      targetCandles,
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
      error_message: serializeBackfillError(error).errorMessage,
    });

    return jsonError(error, 500, jobId);
  }
}

async function syncWithRetry(symbol: string, targetCandles = DEFAULT_BACKFILL_TARGET_CANDLES) {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    try {
      return await syncSingleSymbolToSupabase(symbol, {
        skipIfFetchedOlderThanExisting: true,
        candleLimit: targetCandles,
        targetCandles,
      });
    } catch (error) {
      lastError = error;

      if (attempt < RETRIES) {
        await delay(1_000 * (attempt + 1));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(serializeProviderError(lastError).errorMessage);
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

function getBackfillFetchWindow(targetCandles: number): { lookbackDays: number; startDate: string; endDate: string } {
  const lookbackDays = Math.max(1, getLookbackDaysForCandles(targetCandles));
  const endDate = getVietnamDateString();
  const start = new Date(`${endDate}T00:00:00+07:00`);
  start.setUTCDate(start.getUTCDate() - lookbackDays);

  return {
    lookbackDays,
    startDate: start.toISOString().slice(0, 10),
    endDate,
  };
}

function getVietnamDateString(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function serializeBackfillError(error: unknown): {
  errorMessage: string;
  errorName: string;
  errorStack?: string;
  providerDiagnostics?: Json;
} {
  const serialized = serializeProviderError(error);

  return {
    errorMessage: getShortErrorMessage(serialized.errorMessage),
    errorName: serialized.errorName,
    ...(serialized.errorStack ? { errorStack: serialized.errorStack } : {}),
    ...(extractProviderDiagnostics(error) ? { providerDiagnostics: extractProviderDiagnostics(error) } : {}),
  };
}

function extractProviderDiagnostics(error: unknown): Json | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  const candidate = error as { attempts?: unknown; providerName?: unknown; inputSymbol?: unknown; inputTargetCandles?: unknown };

  if (!Array.isArray(candidate.attempts)) {
    return null;
  }

  return {
    providerName: typeof candidate.providerName === "string" ? candidate.providerName : "unknown",
    inputSymbol: typeof candidate.inputSymbol === "string" ? candidate.inputSymbol : null,
    inputTargetCandles: typeof candidate.inputTargetCandles === "number" ? candidate.inputTargetCandles : null,
    attempts: candidate.attempts as Json,
  };
}

function getShortErrorMessage(error: unknown): string {
  const message = serializeProviderError(error).errorMessage;
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
  const serializedError = serializeBackfillError(error);
  const message = serializedError.errorMessage || "Backfill missing prices that bai.";
  const stack = serializedError.errorStack;

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
