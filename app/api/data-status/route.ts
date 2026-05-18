import { getDataFreshness } from "@/lib/data-source/prices";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const freshness = await getDataFreshness();

    return Response.json({
      ok: true,
      freshness,
    });
  } catch (error) {
    console.error("Read data status failed:", error);
    return Response.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Không đọc được trạng thái dữ liệu.",
      },
      { status: 500 },
    );
  }
}
