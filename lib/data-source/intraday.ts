import {
  buildIntradayDailyCandle,
  fetchIntradayTrades,
  fetchLatestQuote,
} from "@/lib/data-source/vnstock-provider";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import type { OHLCV } from "@/types/stock";

type StockPriceInsert = Database["public"]["Tables"]["stock_prices"]["Insert"];

export type IntradayUpdateResult =
  | {
      updated: true;
      skipped: false;
      providerUsed: "vnstock_intraday";
      latestTradingDate: string;
      candle: OHLCV;
    }
  | {
      updated: false;
      skipped: true;
      providerUsed: "vnstock_intraday";
      latestTradingDate: string | null;
      reason: string;
    };

export async function updateIntradayCandleForSymbol(symbol: string): Promise<IntradayUpdateResult> {
  const normalizedSymbol = symbol.toUpperCase();
  const tradingDate = getVietnamTradingDate();

  if (!isVietnamWeekday()) {
    return {
      updated: false,
      skipped: true,
      providerUsed: "vnstock_intraday",
      latestTradingDate: tradingDate,
      reason: "Ngoài ngày giao dịch theo giờ Việt Nam.",
    };
  }

  const [quote, trades] = await Promise.allSettled([
    fetchLatestQuote(normalizedSymbol),
    fetchIntradayTrades(normalizedSymbol),
  ]);
  const latestQuote = quote.status === "fulfilled" ? quote.value : null;
  const intradayTrades = trades.status === "fulfilled" ? trades.value : [];
  const candle = buildIntradayDailyCandle(normalizedSymbol, {
    quote: latestQuote,
    trades: intradayTrades,
  });

  if (!candle) {
    return {
      updated: false,
      skipped: true,
      providerUsed: "vnstock_intraday",
      latestTradingDate: tradingDate,
      reason: "Không có quote/trade trong phiên đủ hợp lệ.",
    };
  }

  const existing = await readExistingPriceRow(normalizedSymbol, candle.date);

  if (existing?.finalized && !existing.is_intraday) {
    return {
      updated: false,
      skipped: true,
      providerUsed: "vnstock_intraday",
      latestTradingDate: candle.date,
      reason: "DB đã có nến daily chính thức cho ngày này.",
    };
  }

  const row: StockPriceInsert = {
    symbol: normalizedSymbol,
    date: candle.date,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
    is_intraday: true,
    finalized: false,
    source: "vnstock_intraday",
    updated_at: new Date().toISOString(),
  };
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("stock_prices").upsert(row, { onConflict: "symbol,date" });

  if (error) {
    throw error;
  }

  return {
    updated: true,
    skipped: false,
    providerUsed: "vnstock_intraday",
    latestTradingDate: candle.date,
    candle,
  };
}

async function readExistingPriceRow(
  symbol: string,
  date: string,
): Promise<Pick<Database["public"]["Tables"]["stock_prices"]["Row"], "is_intraday" | "finalized"> | null> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("stock_prices")
      .select("is_intraday,finalized")
      .eq("symbol", symbol)
      .eq("date", date)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data as Pick<Database["public"]["Tables"]["stock_prices"]["Row"], "is_intraday" | "finalized">;
  } catch {
    return null;
  }
}

function getVietnamTradingDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function isVietnamWeekday(): boolean {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "short",
  }).format(new Date());

  return weekday !== "Sat" && weekday !== "Sun";
}
