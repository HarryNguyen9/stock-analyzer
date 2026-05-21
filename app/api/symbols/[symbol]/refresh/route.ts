import { getSymbolMetadata } from "@/lib/data-source/supabase-provider";
import {
  DEFAULT_HISTORICAL_CANDLE_LIMIT,
  DEFAULT_RECENT_SYNC_CANDLE_LIMIT,
  TARGET_STOCK_PRICE_CANDLES,
} from "@/lib/data-source/constants";
import { PRICE_SYNC_PIPELINE, readExistingPriceRowCount, syncSingleSymbolToSupabase } from "@/lib/pipeline/price-sync";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RefreshResponse =
  | {
      ok: true;
      pipeline: typeof PRICE_SYNC_PIPELINE.pipeline;
      responsibility: typeof PRICE_SYNC_PIPELINE.responsibility;
      source: typeof PRICE_SYNC_PIPELINE.source;
      symbol: string;
      refreshed: boolean;
      candleLimit: number;
      existingRows: number;
      fetchedCandles: number;
      upsertedCandles: number;
      targetCandles: number;
      latestDateBefore: string | null;
      latestDateAfter: string | null;
      dataDateChanged: boolean;
      durationMs: number;
    }
  | {
      ok: false;
      pipeline: typeof PRICE_SYNC_PIPELINE.pipeline;
      responsibility: typeof PRICE_SYNC_PIPELINE.responsibility;
      source: typeof PRICE_SYNC_PIPELINE.source;
      symbol: string | null;
      message: string;
      durationMs: number;
    };

const COOLDOWN_MS = 60 * 1000;
const refreshCooldown = new Map<string, number>();
const pendingRefreshes = new Map<
  string,
  Promise<{
    refreshed: boolean;
    candleLimit: number;
    existingRows: number;
    fetchedCandles: number;
    upsertedCandles: number;
    targetCandles: number;
    latestDateBefore: string | null;
    latestDateAfter: string | null;
    dataDateChanged: boolean;
  }>
>();

export async function POST(
  _request: Request,
  context: { params: Promise<{ symbol: string }> },
) {
  const startedAt = Date.now();
  const symbol = normalizeSymbol((await context.params).symbol);

  try {
    if (!symbol) {
      return jsonError(null, "Mã cổ phiếu không hợp lệ.", startedAt, 400);
    }

    const metadata = await getSymbolMetadata(symbol);

    if (!metadata) {
      return jsonError(symbol, "Không tìm thấy mã cổ phiếu trong Supabase.", startedAt, 404);
    }

    const pending = pendingRefreshes.get(symbol);

    if (pending) {
      const result = await pending;

      return Response.json({
        ok: true,
        ...PRICE_SYNC_PIPELINE,
        symbol,
        refreshed: result.refreshed,
        candleLimit: result.candleLimit,
        existingRows: result.existingRows,
        fetchedCandles: result.fetchedCandles,
        upsertedCandles: result.upsertedCandles,
        targetCandles: result.targetCandles,
        latestDateBefore: result.latestDateBefore,
        latestDateAfter: result.latestDateAfter,
        dataDateChanged: result.dataDateChanged,
        durationMs: Date.now() - startedAt,
      } satisfies RefreshResponse);
    }

    const lastRefreshAt = refreshCooldown.get(symbol);

    if (lastRefreshAt && Date.now() - lastRefreshAt < COOLDOWN_MS) {
      return Response.json({
        ok: true,
        ...PRICE_SYNC_PIPELINE,
        symbol,
        refreshed: false,
        candleLimit: DEFAULT_RECENT_SYNC_CANDLE_LIMIT,
        existingRows: await readExistingPriceRowCount(symbol),
        fetchedCandles: 0,
        upsertedCandles: 0,
        targetCandles: TARGET_STOCK_PRICE_CANDLES,
        latestDateBefore: await readLatestPriceDate(symbol),
        latestDateAfter: await readLatestPriceDate(symbol),
        dataDateChanged: false,
        durationMs: Date.now() - startedAt,
      } satisfies RefreshResponse);
    }

    refreshCooldown.set(symbol, Date.now());
    const existingRows = await readExistingPriceRowCount(symbol);
    const latestDateBefore = await readLatestPriceDate(symbol);
    const candleLimit =
      existingRows < TARGET_STOCK_PRICE_CANDLES ? DEFAULT_HISTORICAL_CANDLE_LIMIT : DEFAULT_RECENT_SYNC_CANDLE_LIMIT;
    const refreshPromise = syncSingleSymbolToSupabase(symbol, { candleLimit, updateIntraday: true }).then(async (result) => {
      const latestDateAfter = await readLatestPriceDate(symbol);

      return {
        refreshed: result.refreshed,
        candleLimit: result.candleLimit,
        existingRows: result.existingRows,
        fetchedCandles: result.fetchedCandles,
        upsertedCandles: result.upsertedCandles,
        targetCandles: result.targetCandles,
        latestDateBefore,
        latestDateAfter,
        dataDateChanged: Boolean(latestDateAfter && latestDateAfter !== latestDateBefore),
      };
    });

    pendingRefreshes.set(symbol, refreshPromise);

    try {
      const result = await refreshPromise;

      return Response.json({
        ok: true,
        ...PRICE_SYNC_PIPELINE,
        symbol,
        refreshed: result.refreshed,
        candleLimit: result.candleLimit,
        existingRows: result.existingRows,
        fetchedCandles: result.fetchedCandles,
        upsertedCandles: result.upsertedCandles,
        targetCandles: result.targetCandles,
        latestDateBefore: result.latestDateBefore,
        latestDateAfter: result.latestDateAfter,
        dataDateChanged: result.dataDateChanged,
        durationMs: Date.now() - startedAt,
      } satisfies RefreshResponse);
    } finally {
      pendingRefreshes.delete(symbol);
    }
  } catch (error) {
    console.error(`${symbol ?? "UNKNOWN"} refresh failed:`, error);
    return jsonError(
      symbol,
      error instanceof Error ? error.message : "Không làm mới được dữ liệu mã này.",
      startedAt,
      500,
    );
  }
}

async function readLatestPriceDate(symbol: string): Promise<string | null> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("stock_prices")
      .select("date")
      .eq("symbol", symbol.toUpperCase())
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data || typeof data.date !== "string") {
      return null;
    }

    return data.date;
  } catch {
    return null;
  }
}

function normalizeSymbol(value: string): string | null {
  const symbol = value.trim().toUpperCase();
  return /^[A-Z0-9]{2,12}$/.test(symbol) ? symbol : null;
}

function jsonError(symbol: string | null, message: string, startedAt: number, status: number): Response {
  return Response.json(
    {
      ok: false,
      ...PRICE_SYNC_PIPELINE,
      symbol,
      message,
      durationMs: Date.now() - startedAt,
    } satisfies RefreshResponse,
    { status },
  );
}
