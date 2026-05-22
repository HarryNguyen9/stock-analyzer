import { NextResponse } from "next/server";
import { searchCoveredWarrants } from "@/lib/cw/cw-provider";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = normalizeQuery(searchParams.get("q") ?? "");
  const limit = clampLimit(Number(searchParams.get("limit") ?? 8));

  if (query.length === 0) {
    return NextResponse.json({ ok: true, warrants: [] });
  }

  try {
    const warrants = await searchCoveredWarrants(query, limit);
    return NextResponse.json({ ok: true, warrants });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Khong the tim chung quyen.",
      },
      { status: 500 },
    );
  }
}

function normalizeQuery(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function clampLimit(value: number): number {
  if (!Number.isFinite(value)) return 8;
  return Math.min(Math.max(Math.trunc(value), 1), 20);
}
