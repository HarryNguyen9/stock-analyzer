import { PRICE_SYNC_PIPELINE, syncPricesToSupabase } from "@/lib/pipeline/price-sync";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SNAPSHOT_PIPELINE, refreshHomeScannerSnapshot } from "@/lib/pipeline/snapshot";
import type { Database, Json } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CronSuccessResponse = {
  ok: true;
  jobId: string | null;
  pipeline: typeof PRICE_SYNC_PIPELINE.pipeline;
  responsibility: typeof PRICE_SYNC_PIPELINE.responsibility;
  source: typeof PRICE_SYNC_PIPELINE.source;
  batch: number;
  limit: number;
  maxLimit: number;
  limitClamped: boolean;
  candleLimit: number;
  targetCandles: number;
  selected: number;
  synced: number;
  failed: number;
  failedTemporary: Array<{ symbol: string; error: string }>;
  failedUnsupported: Array<{ symbol: string; error: string }>;
  snapshotUpdated: boolean;
  stoppedEarly: boolean;
  stopReason: "time_guard" | null;
  durationMs: number;
};

type CronErrorResponse = {
  ok: false;
  jobId?: string | null;
  message: string;
  pipeline: typeof PRICE_SYNC_PIPELINE.pipeline;
  responsibility: typeof PRICE_SYNC_PIPELINE.responsibility;
  source: typeof PRICE_SYNC_PIPELINE.source;
  stack?: string;
};

type SyncJobInsert = Database["public"]["Tables"]["sync_jobs"]["Insert"];
type SyncJobUpdate = Database["public"]["Tables"]["sync_jobs"]["Update"];

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 25;
const SOFT_TIME_LIMIT_MS = 240_000;

export async function GET(request: Request) {
  return handleSyncPricesCron(request);
}

export async function POST(request: Request) {
  return handleSyncPricesCron(request);
}

async function handleSyncPricesCron(
  request: Request,
): Promise<Response> {
  const startedAt = Date.now();
  let jobId: string | null = null;

  try {
    const secret = process.env.CRON_SECRET;

    if (!secret) {
      throw new Error("CRON_SECRET chua duoc cau hinh.");
    }

    const authorization = request.headers.get("authorization");

    if (authorization !== `Bearer ${secret}`) {
      return jsonError(new Error("Khong co quyen chay cron sync."), 401);
    }

    const url = new URL(request.url);
    const batch = getNumberParam(url, "batch", 0, 0, Number.MAX_SAFE_INTEGER);
    const limitParam = getClampedNumberParam(url, "limit", DEFAULT_LIMIT, 1, MAX_LIMIT);
    const limit = limitParam.value;
    const shouldUpdateSnapshot = getUpdateSnapshotFlag(url, batch);
    jobId = await createSyncJob({
      ...PRICE_SYNC_PIPELINE,
      batch,
      limit,
      maxLimit: MAX_LIMIT,
      limitClamped: limitParam.clamped,
      updateSnapshot: shouldUpdateSnapshot,
      trigger: "cron-route",
      method: request.method,
    });
    const result = await syncPricesToSupabase({
      batch,
      limit,
      shouldStop: () => Date.now() - startedAt >= SOFT_TIME_LIMIT_MS,
    });
    const snapshotUpdated = shouldUpdateSnapshot && !result.stoppedEarly ? await refreshHomeScannerSnapshot() : false;
    const durationMs = Date.now() - startedAt;

    await updateSyncJob(jobId, {
      status: "success",
      finished_at: new Date().toISOString(),
      duration_ms: durationMs,
      selected_count: result.selected,
      success_count: result.synced,
      failed_count: result.failed,
      metadata: {
        batch: result.batch,
        limit: result.limit,
        maxLimit: MAX_LIMIT,
        limitClamped: limitParam.clamped,
        candleLimit: result.candleLimit,
        targetCandles: result.targetCandles,
        selectedSymbols: result.selectedSymbols,
        failedSymbols: result.failedSymbols,
        failedTemporary: result.failedTemporary,
        failedUnsupported: result.failedUnsupported,
        snapshotUpdated,
        snapshotPipeline: shouldUpdateSnapshot ? SNAPSHOT_PIPELINE : null,
        stoppedEarly: result.stoppedEarly,
        stopReason: result.stopReason,
      },
    });

    return Response.json({
      ok: true,
      jobId,
      ...PRICE_SYNC_PIPELINE,
      batch: result.batch,
      limit: result.limit,
      maxLimit: MAX_LIMIT,
      limitClamped: limitParam.clamped,
      candleLimit: result.candleLimit,
      targetCandles: result.targetCandles,
      selected: result.selected,
      synced: result.synced,
      failed: result.failed,
      failedTemporary: result.failedTemporary,
      failedUnsupported: result.failedUnsupported,
      snapshotUpdated,
      stoppedEarly: result.stoppedEarly,
      stopReason: result.stopReason,
      durationMs,
    } satisfies CronSuccessResponse);
  } catch (error) {
    console.error("Cron sync failed:", error);
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

function getNumberParam(url: URL, key: string, fallback: number, min: number, max: number): number {
  const value = url.searchParams.get(key);

  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min ? Math.min(parsed, max) : fallback;
}

function getClampedNumberParam(
  url: URL,
  key: string,
  fallback: number,
  min: number,
  max: number,
): { value: number; clamped: boolean } {
  const value = url.searchParams.get(key);

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

function getUpdateSnapshotFlag(url: URL, batch: number): boolean {
  const value = url.searchParams.get("updateSnapshot");

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return batch === 0;
}

async function createSyncJob(metadata: Json): Promise<string | null> {
  try {
    const supabase = createSupabaseAdminClient();
    const row: SyncJobInsert = {
      job_type: "sync-prices",
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
    console.warn("Khong ghi duoc sync_jobs running:", error);
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
    console.warn("Khong update duoc sync_jobs:", error);
  }
}

function jsonError(error: unknown, status: number, jobId: string | null = null): Response {
  const message = error instanceof Error ? error.message : "Sync du lieu that bai.";
  const stack = error instanceof Error ? error.stack : undefined;

  return Response.json(
    {
      ok: false,
      jobId,
      message,
      ...PRICE_SYNC_PIPELINE,
      ...(process.env.NODE_ENV !== "production" && stack ? { stack } : {}),
    } satisfies CronErrorResponse,
    { status },
  );
}
