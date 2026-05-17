import { syncPricesToSupabase } from "@/scripts/sync-prices-to-supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CronSuccessResponse = {
  ok: true;
  synced: number;
};

type CronErrorResponse = {
  ok: false;
  message: string;
  stack?: string;
};

export async function GET(request: Request) {
  return handleSyncPricesCron(request);
}

export async function POST(request: Request) {
  return handleSyncPricesCron(request);
}

async function handleSyncPricesCron(
  request: Request,
): Promise<Response> {
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
    const result = await syncPricesToSupabase({ limit });

    return Response.json({
      ok: true,
      synced: result.synced,
    } satisfies CronSuccessResponse);
  } catch (error) {
    console.error("Cron sync failed:", error);
    return jsonError(error, 500);
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

function jsonError(error: unknown, status: number): Response {
  const message = error instanceof Error ? error.message : "Sync du lieu that bai.";
  const stack = error instanceof Error ? error.stack : undefined;

  return Response.json(
    {
      ok: false,
      message,
      ...(process.env.NODE_ENV !== "production" && stack ? { stack } : {}),
    } satisfies CronErrorResponse,
    { status },
  );
}
