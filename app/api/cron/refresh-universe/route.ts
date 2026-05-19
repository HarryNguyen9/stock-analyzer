import {
  RANKING_RULES,
  UNIVERSE_RANKING_PIPELINE,
  refreshUniverseRankings,
} from "@/lib/pipeline/universe-ranking";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type UniverseResponse =
  | {
      ok: true;
      jobId: string | null;
      pipeline: typeof UNIVERSE_RANKING_PIPELINE.pipeline;
      responsibility: typeof UNIVERSE_RANKING_PIPELINE.responsibility;
      source: typeof UNIVERSE_RANKING_PIPELINE.source;
      selected: number;
      updated: number;
      topA: number;
      topB: number;
      topC: number;
      eligible: number;
      excluded: number;
      totalSymbols: number;
      withPrices: number;
      skippedDueToMissingPrices: number;
      excludedReasons: Record<string, number>;
      avgTradedValue20: {
        sample: number[];
        min: number;
        max: number;
      };
      sampleEligibleSymbols: Array<{
        symbol: string;
        avgTradedValue20: number;
        activeDays20: number;
        latestClose: number | null;
      }>;
      sampleExcludedSymbols: Array<{
        symbol: string;
        reason: string | null;
        avgTradedValue20: number;
        activeDays20: number;
        latestClose: number | null;
        priceRows: number;
      }>;
      warning?: string;
      durationMs: number;
    }
  | {
      ok: false;
      jobId?: string | null;
      pipeline: typeof UNIVERSE_RANKING_PIPELINE.pipeline;
      responsibility: typeof UNIVERSE_RANKING_PIPELINE.responsibility;
      source: typeof UNIVERSE_RANKING_PIPELINE.source;
      message: string;
      warning?: string;
      selected?: number;
      updated?: number;
      topA?: number;
      topB?: number;
      topC?: number;
      totalSymbols?: number;
      withPrices?: number;
      eligible?: number;
      excluded?: number;
      skippedDueToMissingPrices?: number;
      excludedReasons?: Record<string, number>;
      avgTradedValue20?: {
        sample: number[];
        min: number;
        max: number;
      };
      sampleEligibleSymbols?: Array<{
        symbol: string;
        avgTradedValue20: number;
        activeDays20: number;
        latestClose: number | null;
      }>;
      sampleExcludedSymbols?: Array<{
        symbol: string;
        reason: string | null;
        avgTradedValue20: number;
        activeDays20: number;
        latestClose: number | null;
        priceRows: number;
      }>;
      durationMs?: number;
      stack?: string;
    };

type SyncJobInsert = Database["public"]["Tables"]["sync_jobs"]["Insert"];
type SyncJobUpdate = Database["public"]["Tables"]["sync_jobs"]["Update"];

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
      ...UNIVERSE_RANKING_PIPELINE,
      trigger: "refresh-universe-route",
      method: request.method,
    });

    const result = await refreshUniverseRankings();
    const durationMs = Date.now() - startedAt;

    await updateSyncJob(jobId, {
      status: result.warning ? "warning" : "success",
      finished_at: new Date().toISOString(),
      duration_ms: durationMs,
      selected_count: result.selected,
      success_count: result.updated,
      failed_count: result.failed,
      metadata: {
        ...UNIVERSE_RANKING_PIPELINE,
        topA: result.topA,
        topB: result.topB,
        topC: result.topC,
        eligible: result.eligible,
        excluded: result.excluded,
        ranked: result.ranked,
        warning: result.warning,
        diagnostics: result.diagnostics,
        rankingRules: RANKING_RULES,
      },
    });

    const payload = {
      jobId,
      ...UNIVERSE_RANKING_PIPELINE,
      selected: result.selected,
      updated: result.updated,
      topA: result.topA,
      topB: result.topB,
      topC: result.topC,
      eligible: result.eligible,
      excluded: result.excluded,
      totalSymbols: result.diagnostics.totalSymbols,
      withPrices: result.diagnostics.withPrices,
      skippedDueToMissingPrices: result.diagnostics.skippedDueToMissingPrices,
      excludedReasons: result.diagnostics.excludedReasons,
      avgTradedValue20: result.diagnostics.avgTradedValue20,
      sampleEligibleSymbols: result.diagnostics.sampleEligibleSymbols,
      sampleExcludedSymbols: result.diagnostics.sampleExcludedSymbols,
      durationMs,
    };

    if (result.warning) {
      return Response.json(
        {
          ok: false,
          ...payload,
          message: result.warning,
          warning: result.warning,
        } satisfies UniverseResponse,
        { status: 409 },
      );
    }

    return Response.json({
      ok: true,
      ...payload,
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
      ...UNIVERSE_RANKING_PIPELINE,
      message,
      ...(process.env.NODE_ENV !== "production" && stack ? { stack } : {}),
    } satisfies UniverseResponse,
    { status },
  );
}
