import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/types";
import { PRICE_SYNC_PIPELINE, syncSingleSymbolToSupabase } from "@/lib/pipeline/price-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RetrySymbolRow = Pick<
  Database["public"]["Tables"]["symbols"]["Row"],
  "symbol" | "retry_count" | "last_error" | "next_retry_at"
>;
type SyncJobInsert = Database["public"]["Tables"]["sync_jobs"]["Insert"];
type SyncJobUpdate = Database["public"]["Tables"]["sync_jobs"]["Update"];

type RetryResponse =
  | {
      ok: true;
      jobId: string | null;
      pipeline: typeof PRICE_SYNC_PIPELINE.pipeline;
      responsibility: typeof PRICE_SYNC_PIPELINE.responsibility;
      source: typeof PRICE_SYNC_PIPELINE.source;
      selected: number;
      synced: number;
      failed: number;
      durationMs: number;
    }
  | {
      ok: false;
      jobId?: string | null;
      pipeline: typeof PRICE_SYNC_PIPELINE.pipeline;
      responsibility: typeof PRICE_SYNC_PIPELINE.responsibility;
      source: typeof PRICE_SYNC_PIPELINE.source;
      message: string;
      stack?: string;
    };

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const FAILED_QUERY_LIMIT = 1_000;

export async function GET(request: Request) {
  return handleRetryFailedSymbols(request);
}

export async function POST(request: Request) {
  return handleRetryFailedSymbols(request);
}

async function handleRetryFailedSymbols(request: Request): Promise<Response> {
  const startedAt = Date.now();
  let jobId: string | null = null;

  try {
    const secret = process.env.CRON_SECRET;

    if (!secret) {
      throw new Error("CRON_SECRET chua duoc cau hinh.");
    }

    if (request.headers.get("authorization") !== `Bearer ${secret}`) {
      return jsonError(new Error("Khong co quyen chay retry failed symbols."), 401, jobId);
    }

    const limit = getNumberParam(request, "limit", DEFAULT_LIMIT, 1, MAX_LIMIT);
    const targets = await getRetryTargets(limit);
    const failedSymbols: string[] = [];
    const processedSymbols: Array<{ symbol: string; status: "synced" | "failed"; message?: string }> = [];

    jobId = await createSyncJob({
      ...PRICE_SYNC_PIPELINE,
      trigger: "retry-failed-symbols-route",
      method: request.method,
      limit,
      selectedSymbols: targets.map((target) => target.symbol),
    });

    let synced = 0;
    let failed = 0;

    for (const target of targets) {
      try {
        await syncSingleSymbolToSupabase(target.symbol);
        synced += 1;
        processedSymbols.push({ symbol: target.symbol, status: "synced" });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failed += 1;
        failedSymbols.push(target.symbol);
        processedSymbols.push({ symbol: target.symbol, status: "failed", message });
      }
    }

    const durationMs = Date.now() - startedAt;

    await updateSyncJob(jobId, {
      status: failed > 0 && synced === 0 && targets.length > 0 ? "failed" : "success",
      finished_at: new Date().toISOString(),
      duration_ms: durationMs,
      selected_count: targets.length,
      success_count: synced,
      failed_count: failed,
      error_message: failed > 0 && synced === 0 && targets.length > 0 ? "Retry failed for all selected symbols." : null,
      metadata: {
        ...PRICE_SYNC_PIPELINE,
        failedSymbols,
        processedSymbols,
      },
    });

    return Response.json({
      ok: true,
      jobId,
      ...PRICE_SYNC_PIPELINE,
      selected: targets.length,
      synced,
      failed,
      durationMs,
    } satisfies RetryResponse);
  } catch (error) {
    console.error("Retry failed symbols failed:", error);
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

async function getRetryTargets(limit: number): Promise<RetrySymbolRow[]> {
  const supabase = createSupabaseAdminClient();
  const now = Date.now();
  const { data, error } = await supabase
    .from("symbols")
    .select("symbol,retry_count,last_error,next_retry_at")
    .eq("sync_status", "failed")
    .order("next_retry_at", { ascending: true, nullsFirst: true })
    .order("symbol", { ascending: true })
    .limit(FAILED_QUERY_LIMIT);

  if (error) {
    throw error;
  }

  return ((data ?? []) as RetrySymbolRow[])
    .filter((row) => !row.next_retry_at || new Date(row.next_retry_at).getTime() <= now)
    .slice(0, limit)
    .map((row) => ({
      ...row,
      symbol: row.symbol.toUpperCase(),
    }));
}

function getNumberParam(request: Request, key: string, fallback: number, min: number, max: number): number {
  const value = new URL(request.url).searchParams.get(key);

  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min ? Math.min(parsed, max) : fallback;
}

async function createSyncJob(metadata: Json): Promise<string | null> {
  try {
    const supabase = createSupabaseAdminClient();
    const row: SyncJobInsert = {
      job_type: "retry_failed_symbols",
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
    console.warn("Khong ghi duoc sync_jobs retry_failed_symbols running:", error);
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
    console.warn("Khong update duoc sync_jobs retry_failed_symbols:", error);
  }
}

function jsonError(error: unknown, status: number, jobId: string | null = null): Response {
  const message = error instanceof Error ? error.message : "Retry failed symbols that bai.";
  const stack = error instanceof Error ? error.stack : undefined;

  return Response.json(
    {
      ok: false,
      jobId,
      ...PRICE_SYNC_PIPELINE,
      message,
      ...(process.env.NODE_ENV !== "production" && stack ? { stack } : {}),
    } satisfies RetryResponse,
    { status },
  );
}
