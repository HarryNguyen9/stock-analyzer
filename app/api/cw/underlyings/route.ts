import { NextResponse } from "next/server";
import { searchCoveredWarrantUnderlyings } from "@/lib/cw/cw-provider";

export async function GET(request: Request) {
  const startedAt = Date.now();
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const limit = clampLimit(Number(searchParams.get("limit") ?? 20));
  const underlyings = await searchCoveredWarrantUnderlyings(query, limit);

  return NextResponse.json({
    ok: true,
    underlyings,
    durationMs: Date.now() - startedAt,
  });
}

function clampLimit(value: number): number {
  if (!Number.isFinite(value)) return 20;
  return Math.min(Math.max(Math.trunc(value), 1), 20);
}

