export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AdminJob = "backfill" | "metadata";

export async function POST(request: Request) {
  try {
    const adminSecret = process.env.ADMIN_SYNC_SECRET;
    const cronSecret = process.env.CRON_SECRET;

    if (!adminSecret || !cronSecret) {
      return Response.json(
        {
          ok: false,
          message: "Chưa cấu hình ADMIN_SYNC_SECRET hoặc CRON_SECRET trên server.",
        },
        { status: 500 },
      );
    }

    if (!isAuthorized(request, adminSecret)) {
      return Response.json(
        {
          ok: false,
          message: "Không có quyền chạy admin job.",
        },
        { status: 401 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as { job?: string };
    const job = body.job as AdminJob | undefined;
    const targetPath = getTargetPath(job);

    if (!targetPath) {
      return Response.json(
        {
          ok: false,
          message: "Admin job không hợp lệ.",
        },
        { status: 400 },
      );
    }

    const response = await fetch(`${new URL(request.url).origin}${targetPath}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      return Response.json(
        {
          ok: false,
          message: payload && typeof payload.message === "string" ? payload.message : "Admin job thất bại.",
          details: payload,
        },
        { status: response.status },
      );
    }

    return Response.json({
      ok: true,
      message: "Đã chạy admin job.",
      job,
      result: payload,
    });
  } catch (error) {
    console.error("Admin run job failed:", error);
    return Response.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Không chạy được admin job.",
      },
      { status: 500 },
    );
  }
}

function getTargetPath(job: AdminJob | undefined): string | null {
  if (job === "backfill") {
    return "/api/cron/backfill-missing-prices?limit=5";
  }

  if (job === "metadata") {
    return "/api/cron/sync-symbol-metadata";
  }

  return null;
}

function isAuthorized(request: Request, adminSecret: string): boolean {
  const secretHeader = request.headers.get("x-admin-sync-secret");
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

  return secretHeader === adminSecret || bearerToken === adminSecret;
}
