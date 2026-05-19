import { NextResponse } from "next/server";
import { getCoveredWarrantsByUnderlying, getSupportedSampleUnderlyings } from "@/lib/cw/cw-provider";

export async function GET(request: Request) {
  const startedAt = Date.now();
  const { searchParams } = new URL(request.url);
  const underlying = normalizeUnderlying(searchParams.get("underlying") ?? "FPT");

  if (!underlying) {
    return NextResponse.json(
      {
        ok: false,
        message: "Vui lòng nhập mã cơ sở.",
        warrants: [],
      },
      { status: 400 },
    );
  }

  const result = await getCoveredWarrantsByUnderlying(underlying);

  return NextResponse.json({
    ok: true,
    underlying: result.underlying,
    warrants: result.warrants,
    source: result.source,
    updatedAt: result.updatedAt,
    supportedSamples: getSupportedSampleUnderlyings(),
    durationMs: Date.now() - startedAt,
  });
}

function normalizeUnderlying(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

