import { getDataQualitySnapshot, isAdminToolsEnabled } from "@/lib/admin/data-quality";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const adminSecret = process.env.ADMIN_SYNC_SECRET;

    if (!isAdminToolsEnabled() && (!adminSecret || !isAuthorized(request, adminSecret))) {
      return Response.json(
        {
          ok: false,
          message: "Không có quyền xem data quality dashboard.",
        },
        { status: 401 },
      );
    }

    return Response.json({
      ok: true,
      data: await getDataQualitySnapshot(),
    });
  } catch (error) {
    console.error("Data quality API failed:", error);
    return Response.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Không tải được data quality dashboard.",
      },
      { status: 500 },
    );
  }
}

function isAuthorized(request: Request, adminSecret: string): boolean {
  const secretHeader = request.headers.get("x-admin-sync-secret");
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

  return secretHeader === adminSecret || bearerToken === adminSecret;
}
