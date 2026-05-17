import { auditSymbolMetadata } from "@/lib/symbols/metadata-audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AuditSymbolMetadataResponse =
  | {
      ok: true;
      jobId: string | null;
      total: number;
      suspiciousCount: number;
      criticalCount: number;
      warningCount: number;
      infoCount: number;
      issueSummary: Awaited<ReturnType<typeof auditSymbolMetadata>>["issueSummary"];
      suspiciousSymbols: Awaited<ReturnType<typeof auditSymbolMetadata>>["suspiciousSymbols"];
      infoSymbols: Awaited<ReturnType<typeof auditSymbolMetadata>>["infoSymbols"];
      durationMs: number;
    }
  | {
      ok: false;
      jobId?: string | null;
      message: string;
      stack?: string;
    };

type SyncJobInsert = Database["public"]["Tables"]["sync_jobs"]["Insert"];
type SyncJobUpdate = Database["public"]["Tables"]["sync_jobs"]["Update"];

export async function GET(request: Request) {
  return handleAuditSymbolMetadata(request);
}

export async function POST(request: Request) {
  return handleAuditSymbolMetadata(request);
}

async function handleAuditSymbolMetadata(request: Request): Promise<Response> {
  const startedAt = Date.now();
  let jobId: string | null = null;

  try {
    const secret = process.env.CRON_SECRET;

    if (!secret) {
      throw new Error("CRON_SECRET chua duoc cau hinh.");
    }

    if (request.headers.get("authorization") !== `Bearer ${secret}`) {
      return jsonError(new Error("Khong co quyen chay audit symbol metadata."), 401, jobId);
    }

    jobId = await createSyncJob({
      trigger: "audit-symbol-metadata-route",
      method: request.method,
    });

    const result = await auditSymbolMetadata();
    const durationMs = Date.now() - startedAt;

    await updateSyncJob(jobId, {
      status: "success",
      finished_at: new Date().toISOString(),
      duration_ms: durationMs,
      selected_count: result.total,
      success_count: result.total,
      failed_count: 0,
      metadata: toJson({
        suspiciousCount: result.suspiciousCount,
        criticalCount: result.criticalCount,
        warningCount: result.warningCount,
        infoCount: result.infoCount,
        issueSummary: result.issueSummary,
        suspiciousSymbols: result.suspiciousSymbols,
        infoSymbols: result.infoSymbols,
      }),
    });

    return Response.json({
      ok: true,
      jobId,
      total: result.total,
      suspiciousCount: result.suspiciousCount,
      criticalCount: result.criticalCount,
      warningCount: result.warningCount,
      infoCount: result.infoCount,
      issueSummary: result.issueSummary,
      suspiciousSymbols: result.suspiciousSymbols,
      infoSymbols: result.infoSymbols,
      durationMs,
    } satisfies AuditSymbolMetadataResponse);
  } catch (error) {
    console.error("Audit symbol metadata failed:", error);
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
      job_type: "audit_symbol_metadata",
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
    console.warn("Khong ghi duoc sync_jobs audit_symbol_metadata running:", error);
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
    console.warn("Khong update duoc sync_jobs audit_symbol_metadata:", error);
  }
}

function jsonError(error: unknown, status: number, jobId: string | null = null): Response {
  const message = error instanceof Error ? error.message : "Audit symbol metadata that bai.";
  const stack = error instanceof Error ? error.stack : undefined;

  return Response.json(
    {
      ok: false,
      jobId,
      message,
      ...(process.env.NODE_ENV !== "production" && stack ? { stack } : {}),
    } satisfies AuditSymbolMetadataResponse,
    { status },
  );
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}
