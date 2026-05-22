import { DEFAULT_RECENT_SYNC_CANDLE_LIMIT } from "@/lib/data-source/constants";
import { serializeProviderError } from "@/lib/data-source/provider-errors";
import {
  getVietnamTradingDate,
  isVietnamAfterMarketClose,
  isVietnamWeekend,
} from "@/lib/data-source/vietnam-market-time";
import { vnstockProvider } from "@/lib/data-source/vnstock-provider";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import type { OHLCV } from "@/types/stock";

type StockPriceInsert = Database["public"]["Tables"]["stock_prices"]["Insert"];

export type FinalizeDailyCandleResult =
  | {
      symbol: string;
      finalized: true;
      tradingDate: string;
      providerDate: string;
      providerUsed: "vnstock_daily";
    }
  | {
      symbol: string;
      finalized: false;
      skipped: true;
      tradingDate: string;
      providerDate: string | null;
      reason: string;
      providerUsed: "vnstock_daily";
    };

export async function finalizeDailyCandleForSymbol(symbol: string): Promise<FinalizeDailyCandleResult> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const tradingDate = getVietnamTradingDate();

  if (isVietnamWeekend()) {
    return skipped(normalizedSymbol, tradingDate, null, "Thi truong dang nghi cuoi tuan.");
  }

  if (!isVietnamAfterMarketClose()) {
    return skipped(normalizedSymbol, tradingDate, null, "Chua toi gio chot nen dong phien.");
  }

  const prices = await vnstockProvider.getDailyPrices(normalizedSymbol, DEFAULT_RECENT_SYNC_CANDLE_LIMIT);
  const latestDaily = prices.at(-1) ?? null;

  if (!latestDaily) {
    return skipped(normalizedSymbol, tradingDate, null, "Provider chua tra ve nen daily hop le.");
  }

  if (latestDaily.date !== tradingDate) {
    return skipped(
      normalizedSymbol,
      tradingDate,
      latestDaily.date,
      `Provider daily moi nhat la ${latestDaily.date}, chua co nen dong phien ${tradingDate}.`,
    );
  }

  await upsertFinalizedDailyCandle(normalizedSymbol, latestDaily);

  return {
    symbol: normalizedSymbol,
    finalized: true,
    tradingDate,
    providerDate: latestDaily.date,
    providerUsed: "vnstock_daily",
  };
}

export async function finalizeDailyCandleSafely(symbol: string): Promise<FinalizeDailyCandleResult> {
  try {
    return await finalizeDailyCandleForSymbol(symbol);
  } catch (error) {
    const message = serializeProviderError(error).errorMessage;
    return skipped(symbol.trim().toUpperCase(), getVietnamTradingDate(), null, message);
  }
}

async function upsertFinalizedDailyCandle(symbol: string, candle: OHLCV) {
  const supabase = createSupabaseAdminClient();
  const row: StockPriceInsert = {
    symbol,
    date: candle.date,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
    is_intraday: false,
    finalized: true,
    source: "vnstock_daily",
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("stock_prices").upsert(row, { onConflict: "symbol,date" });

  if (error) {
    throw error;
  }
}

function skipped(symbol: string, tradingDate: string, providerDate: string | null, reason: string): FinalizeDailyCandleResult {
  return {
    symbol,
    finalized: false,
    skipped: true,
    tradingDate,
    providerDate,
    reason,
    providerUsed: "vnstock_daily",
  };
}
