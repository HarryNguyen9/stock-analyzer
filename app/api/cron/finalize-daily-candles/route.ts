import { finalizeDailyCandleSafely, type FinalizeDailyCandleResult } from "@/lib/data-source/finalize-daily";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SymbolRow = Pick<Database["public"]["Tables"]["symbols"]["Row"], "symbol">;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 25;

export async function GET(request: Request) {
  return handleFinalize(request);
}

export async function POST(request: Request) {
  return handleFinalize(request);
}

async function handleFinalize(request: Request): Promise<Response> {
  const startedAt = Date.now();

  try {
    const secret = process.env.CRON_SECRET;

    if (!secret) {
      throw new Error("CRON_SECRET chua duoc cau hinh.");
    }

    if (request.headers.get("authorization") !== `Bearer ${secret}`) {
      return Response.json({ ok: false, message: "Khong co quyen chay finalize daily candles." }, { status: 401 });
    }

    const url = new URL(request.url);
    const batch = getNumberParam(url, "batch", 0, 0, Number.MAX_SAFE_INTEGER);
    const limitParam = getClampedNumberParam(url, "limit", DEFAULT_LIMIT, 1, MAX_LIMIT);
    const symbols = await readFinalizeTargets(batch, limitParam.value);
    const results: FinalizeDailyCandleResult[] = [];

    for (const symbol of symbols) {
      results.push(await finalizeDailyCandleSafely(symbol));
    }

    const finalized = results.filter((result) => result.finalized).length;
    const skipped = results.length - finalized;

    return Response.json({
      ok: true,
      pipeline: "finalize-daily-candles",
      responsibility: "Overwrite intraday candles with official daily candles when provider publishes them.",
      source: "vnstock_daily",
      batch,
      limit: limitParam.value,
      maxLimit: MAX_LIMIT,
      limitClamped: limitParam.clamped,
      selected: symbols.length,
      finalized,
      skipped,
      results,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("Finalize daily candles failed:", error);
    return Response.json(
      {
        ok: false,
        pipeline: "finalize-daily-candles",
        message: error instanceof Error ? error.message : "Finalize daily candles failed.",
        stack: process.env.NODE_ENV !== "production" && error instanceof Error ? error.stack : undefined,
        durationMs: Date.now() - startedAt,
      },
      { status: 500 },
    );
  }
}

async function readFinalizeTargets(batch: number, limit: number): Promise<string[]> {
  const from = batch * limit;
  const to = from + limit - 1;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("symbols")
    .select("symbol")
    .eq("auto_sync", true)
    .eq("is_active", true)
    .or("sync_status.is.null,sync_status.neq.unsupported")
    .order("liquidity_rank", { ascending: true, nullsFirst: false })
    .order("symbol", { ascending: true })
    .range(from, to);

  if (error) {
    throw error;
  }

  return ((data ?? []) as SymbolRow[]).map((row) => row.symbol.toUpperCase());
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
