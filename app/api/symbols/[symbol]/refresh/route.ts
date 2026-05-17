import { getSymbolMetadata } from "@/lib/data-source/supabase-provider";
import { syncSingleSymbolToSupabase } from "@/scripts/sync-prices-to-supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RefreshResponse =
  | {
      ok: true;
      symbol: string;
      refreshed: boolean;
      durationMs: number;
    }
  | {
      ok: false;
      symbol: string | null;
      message: string;
      durationMs: number;
    };

const COOLDOWN_MS = 60 * 1000;
const refreshCooldown = new Map<string, number>();
const pendingRefreshes = new Map<string, Promise<{ refreshed: boolean }>>();

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
        symbol,
        refreshed: result.refreshed,
        durationMs: Date.now() - startedAt,
      } satisfies RefreshResponse);
    }

    const lastRefreshAt = refreshCooldown.get(symbol);

    if (lastRefreshAt && Date.now() - lastRefreshAt < COOLDOWN_MS) {
      return Response.json({
        ok: true,
        symbol,
        refreshed: false,
        durationMs: Date.now() - startedAt,
      } satisfies RefreshResponse);
    }

    refreshCooldown.set(symbol, Date.now());
    const refreshPromise = syncSingleSymbolToSupabase(symbol).then((result) => ({
      refreshed: result.refreshed,
    }));

    pendingRefreshes.set(symbol, refreshPromise);

    try {
      const result = await refreshPromise;

      return Response.json({
        ok: true,
        symbol,
        refreshed: result.refreshed,
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

function normalizeSymbol(value: string): string | null {
  const symbol = value.trim().toUpperCase();
  return /^[A-Z0-9]{2,12}$/.test(symbol) ? symbol : null;
}

function jsonError(symbol: string | null, message: string, startedAt: number, status: number): Response {
  return Response.json(
    {
      ok: false,
      symbol,
      message,
      durationMs: Date.now() - startedAt,
    } satisfies RefreshResponse,
    { status },
  );
}
