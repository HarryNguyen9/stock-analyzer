import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCoveredWarrantProvider } from "@/lib/cw/providers/dnse-cw-provider";
import type { Json } from "@/lib/supabase/types";

type CoveredWarrantUpsert = {
  symbol: string;
  underlying_symbol: string;
  issuer: string | null;
  type: string | null;
  strike_price: number | null;
  exercise_ratio: number | null;
  maturity_date: string | null;
  last_price: number | null;
  bid: number | null;
  ask: number | null;
  volume: number | null;
  open_interest: number | null;
  is_active: boolean;
  source: string | null;
  raw: Json | null;
  updated_at: string;
};

export async function GET(request: Request) {
  return syncCoveredWarrants(request);
}

export async function POST(request: Request) {
  return syncCoveredWarrants(request);
}

async function syncCoveredWarrants(request: Request) {
  const startedAt = Date.now();
  const authHeader = request.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const provider = getCoveredWarrantProvider();
    const result = await provider.fetchCoveredWarrants();
    const now = new Date().toISOString();
    const rows: CoveredWarrantUpsert[] = result.warrants.map((warrant) => ({
      symbol: warrant.symbol,
      underlying_symbol: warrant.underlyingSymbol,
      issuer: warrant.issuer,
      type: warrant.type,
      strike_price: warrant.strikePrice,
      exercise_ratio: warrant.exerciseRatio,
      maturity_date: warrant.maturityDate,
      last_price: warrant.lastPrice,
      bid: warrant.bid,
      ask: warrant.ask,
      volume: warrant.volume,
      open_interest: warrant.openInterest,
      is_active: warrant.isActive,
      source: warrant.source,
      raw: warrant.raw as Json | null,
      updated_at: now,
    }));

    const supabase = createSupabaseAdminClient();
    let upserted = 0;

    if (rows.length > 0) {
      const { error } = await supabase.from("covered_warrants").upsert(rows, { onConflict: "symbol" });
      if (error) throw new Error(`Không upsert được covered_warrants: ${error.message}`);
      upserted = rows.length;
    }

    let deactivated = 0;
    if (rows.length > 0) {
      const fetchedSymbols = new Set(rows.map((row) => row.symbol));
      const { data: activeRows, error: activeError } = await supabase
        .from("covered_warrants")
        .select("symbol")
        .eq("is_active", true);

      if (!activeError) {
        const missingSymbols = (activeRows ?? [])
          .map((row) => row.symbol)
          .filter((symbol) => !fetchedSymbols.has(symbol));

        if (missingSymbols.length > 0) {
          const { error: deactivateError } = await supabase
            .from("covered_warrants")
            .update({ is_active: false, updated_at: now })
            .in("symbol", missingSymbols);

          if (!deactivateError) {
            deactivated = missingSymbols.length;
          } else {
            console.warn("Không deactivate được CW cũ:", deactivateError.message);
          }
        }
      } else {
        console.warn("Không đọc được CW active để deactivate:", activeError.message);
      }
    } else {
      console.warn("DNSE CW provider không trả được mã hợp lệ, bỏ qua deactivate để tránh tắt nhầm dữ liệu cũ.", {
        fetched: result.diagnostics.fetchedCount,
        skipped: result.diagnostics.skippedCount,
      });
    }

    return NextResponse.json({
      ok: true,
      provider: result.diagnostics.providerName,
      fetched: result.diagnostics.fetchedCount,
      upserted,
      skipped: result.diagnostics.skippedCount,
      deactivated,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không đồng bộ được chứng quyền.";

    return NextResponse.json(
      {
        ok: false,
        provider: "dnse",
        message,
        fetched: 0,
        upserted: 0,
        skipped: 0,
        deactivated: 0,
        durationMs: Date.now() - startedAt,
      },
      { status: message.includes("not configured") ? 400 : 500 },
    );
  }
}
