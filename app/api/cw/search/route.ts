import { NextResponse } from "next/server";
import { getCoveredWarrantsByUnderlying } from "@/lib/cw/cw-provider";

export async function GET(request: Request) {
  const startedAt = Date.now();
  const { searchParams } = new URL(request.url);
  const underlying = normalizeUnderlying(searchParams.get("underlying") ?? "");

  if (!underlying) {
    return NextResponse.json({
      ok: true,
      underlying: "",
      warrants: [],
      message: "Nhập mã cơ sở để xem chứng quyền đang giao dịch.",
      durationMs: Date.now() - startedAt,
    });
  }

  const result = await getCoveredWarrantsByUnderlying(underlying);

  return NextResponse.json({
    ok: true,
    underlying: result.underlying,
    warrants: result.warrants,
    source: result.source,
    updatedAt: result.updatedAt,
    message: result.message,
    durationMs: Date.now() - startedAt,
  });
}

function normalizeUnderlying(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

