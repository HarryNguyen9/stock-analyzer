import { searchSymbols } from "@/lib/symbols/search";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const limit = Number(url.searchParams.get("limit") ?? "");

  try {
    const result = await searchSymbols({
      q,
      limit: Number.isFinite(limit) ? limit : null,
    });

    return Response.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error("Symbol search failed:", error);
    return Response.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Không tải được danh sách, vui lòng thử lại",
        stocks: [],
        source: "empty",
        durationMs: 0,
        limit: Number.isFinite(limit) ? limit : 30,
      },
      { status: 500 },
    );
  }
}
