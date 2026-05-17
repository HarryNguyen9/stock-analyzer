import { syncPricesToSupabase } from "@/scripts/sync-prices-to-supabase";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CronSuccessResponse = {
  ok: true;
  jobId: string | null;
  selected: number;
  synced: number;
  failed: number;
  durationMs: number;
};

type CronErrorResponse = {
  ok: false;
  jobId?: string | null;
  message: string;
  stack?: string;
};

type SyncJobInsert = Database["public"]["Tables"]["sync_jobs"]["Insert"];
type SyncJobUpdate = Database["public"]["Tables"]["sync_jobs"]["Update"];

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

    const limit = getLimitFromRequest(request);
    jobId = await createSyncJob({
      limit: limit ?? 300,
      trigger: "cron-route",
      method: request.method,
    });
    const result = await syncPricesToSupabase({ limit });
    const durationMs = Date.now() - startedAt;

    await updateSyncJob(jobId, {
      status: "success",
      finished_at: new Date().toISOString(),
      duration_ms: durationMs,
      selected_count: result.selected,
      success_count: result.synced,
      failed_count: result.failed,
    });

    return Response.json({
      ok: true,
      jobId,
      selected: result.selected,
      synced: result.synced,
      failed: result.failed,
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

function getLimitFromRequest(request: Request): number | undefined {
  const value = new URL(request.url).searchParams.get("limit");

  if (!value) {
    return undefined;
  }

  const limit = Number(value);
  return Number.isInteger(limit) && limit > 0 ? limit : undefined;
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
      ...(process.env.NODE_ENV !== "production" && stack ? { stack } : {}),
    } satisfies CronErrorResponse,
    { status },
  );
}
