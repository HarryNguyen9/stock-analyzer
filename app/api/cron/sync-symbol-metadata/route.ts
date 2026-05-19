import { SYMBOL_METADATA_PIPELINE, syncSymbolMetadata } from "@/lib/pipeline/symbol-metadata";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type MetadataSyncResponse =
  | {
      ok: true;
      jobId: string | null;
      pipeline: typeof SYMBOL_METADATA_PIPELINE.pipeline;
      responsibility: typeof SYMBOL_METADATA_PIPELINE.responsibility;
      selected: number;
      inserted: number;
      updated: number;
      unchanged: number;
      overrideAppliedCount: number;
      overriddenSymbols: string[];
      source: string;
      providerName: string;
      fetchedCount: number;
      fallbackUsed: boolean;
      staticFallbackUsed: boolean;
      sampleChangedSymbols: string[];
      durationMs: number;
    }
  | {
      ok: false;
      jobId?: string | null;
      pipeline: typeof SYMBOL_METADATA_PIPELINE.pipeline;
      responsibility: typeof SYMBOL_METADATA_PIPELINE.responsibility;
      source: typeof SYMBOL_METADATA_PIPELINE.source;
      message: string;
      stack?: string;
    };

type SyncJobInsert = Database["public"]["Tables"]["sync_jobs"]["Insert"];
type SyncJobUpdate = Database["public"]["Tables"]["sync_jobs"]["Update"];

export async function GET(request: Request) {
  return handleSyncSymbolMetadata(request);
}

export async function POST(request: Request) {
  return handleSyncSymbolMetadata(request);
}

async function handleSyncSymbolMetadata(request: Request): Promise<Response> {
  const startedAt = Date.now();
  let jobId: string | null = null;

  try {
    const secret = process.env.CRON_SECRET;

    if (!secret) {
      throw new Error("CRON_SECRET chua duoc cau hinh.");
    }

    if (request.headers.get("authorization") !== `Bearer ${secret}`) {
      return jsonError(new Error("Khong co quyen chay sync symbol metadata."), 401, jobId);
    }

    jobId = await createSyncJob({
      ...SYMBOL_METADATA_PIPELINE,
      trigger: "sync-symbol-metadata-route",
      method: request.method,
    });
    const result = await syncSymbolMetadata();
    const durationMs = Date.now() - startedAt;

    await updateSyncJob(jobId, {
      status: "success",
      finished_at: new Date().toISOString(),
      duration_ms: durationMs,
      selected_count: result.selected,
      success_count: result.inserted + result.updated,
      failed_count: 0,
      metadata: {
        pipeline: SYMBOL_METADATA_PIPELINE.pipeline,
        responsibility: SYMBOL_METADATA_PIPELINE.responsibility,
        pipelineSource: SYMBOL_METADATA_PIPELINE.source,
        inserted: result.inserted,
        updated: result.updated,
        unchanged: result.unchanged,
        overrideAppliedCount: result.overrideAppliedCount,
        overriddenSymbols: result.overriddenSymbols,
        source: result.source,
        providerName: result.providerName,
        fetchedCount: result.fetchedCount,
        fallbackUsed: result.fallbackUsed,
        staticFallbackUsed: result.staticFallbackUsed,
        sampleChangedSymbols: result.sampleChangedSymbols,
      },
    });

    console.info("sync-symbol-metadata completed", {
      source: result.source,
      providerName: result.providerName,
      fetchedCount: result.fetchedCount,
      fallbackUsed: result.fallbackUsed,
      staticFallbackUsed: result.staticFallbackUsed,
      sampleChangedSymbols: result.sampleChangedSymbols,
    });

    return Response.json({
      ok: true,
      jobId,
      pipeline: SYMBOL_METADATA_PIPELINE.pipeline,
      responsibility: SYMBOL_METADATA_PIPELINE.responsibility,
      selected: result.selected,
      inserted: result.inserted,
      updated: result.updated,
      unchanged: result.unchanged,
      overrideAppliedCount: result.overrideAppliedCount,
      overriddenSymbols: result.overriddenSymbols,
      source: result.source,
      providerName: result.providerName,
      fetchedCount: result.fetchedCount,
      fallbackUsed: result.fallbackUsed,
      staticFallbackUsed: result.staticFallbackUsed,
      sampleChangedSymbols: result.sampleChangedSymbols,
      durationMs,
    } satisfies MetadataSyncResponse);
  } catch (error) {
    console.error("Sync symbol metadata failed:", error);
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
      job_type: "sync_symbol_metadata",
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
    console.warn("Khong ghi duoc sync_jobs sync_symbol_metadata running:", error);
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
    console.warn("Khong update duoc sync_jobs sync_symbol_metadata:", error);
  }
}

function jsonError(error: unknown, status: number, jobId: string | null = null): Response {
  const message = error instanceof Error ? error.message : "Sync symbol metadata that bai.";
  const stack = error instanceof Error ? error.stack : undefined;

  return Response.json(
    {
      ok: false,
      jobId,
      ...SYMBOL_METADATA_PIPELINE,
      message,
      ...(process.env.NODE_ENV !== "production" && stack ? { stack } : {}),
    } satisfies MetadataSyncResponse,
    { status },
  );
}
