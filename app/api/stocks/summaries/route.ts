import { getStockSummaries } from "@/lib/data-source/prices";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const startedAt = Date.now();

  try {
    const stocks = await getStockSummaries();

    return Response.json({
      ok: true,
      stocks,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("Stock summaries API failed:", error);
    return Response.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Không tải được danh sách cổ phiếu.",
        stocks: [],
        durationMs: Date.now() - startedAt,
      },
      { status: 500 },
    );
  }
}
