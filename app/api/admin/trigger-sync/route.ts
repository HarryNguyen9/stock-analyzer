export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WORKFLOW_FILE = "sync-stock-data.yml";
const WORKFLOW_REF = "main";

export async function POST(request: Request) {
  try {
    const adminSecret = process.env.ADMIN_SYNC_SECRET;

    if (!adminSecret) {
      return Response.json(
        {
          ok: false,
          message: "Chưa cấu hình ADMIN_SYNC_SECRET trên server.",
        },
        { status: 500 },
      );
    }

    if (adminSecret && !isAuthorized(request, adminSecret)) {
      return Response.json(
        {
          ok: false,
          message: "Không có quyền tải lại dữ liệu.",
        },
        { status: 401 },
      );
    }

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const token = process.env.GITHUB_ACTION_TOKEN;

    if (!owner || !repo || !token) {
      return Response.json(
        {
          ok: false,
          message: "Chưa cấu hình GitHub Action trigger trên server.",
        },
        { status: 500 },
      );
    }

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({ ref: WORKFLOW_REF }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("GitHub workflow dispatch failed:", {
        status: response.status,
        body: errorText,
      });

      return Response.json(
        {
          ok: false,
          message: `Không gửi được lệnh cập nhật dữ liệu (${response.status}).`,
        },
        { status: 502 },
      );
    }

    return Response.json({
      ok: true,
      message: "Đã gửi lệnh cập nhật. Dữ liệu sẽ được cập nhật sau vài phút.",
      triggeredAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Manual sync trigger failed:", error);
    return Response.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Không gửi được lệnh cập nhật dữ liệu.",
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
