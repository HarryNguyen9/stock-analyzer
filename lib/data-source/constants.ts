export const DEFAULT_DETAIL_CANDLE_LIMIT = 600;
export const DEFAULT_BACKFILL_TARGET_CANDLES = 600;
export const DEFAULT_HISTORICAL_CANDLE_LIMIT = DEFAULT_DETAIL_CANDLE_LIMIT;
export const DEFAULT_RECENT_SYNC_CANDLE_LIMIT = 220;
export const TARGET_STOCK_PRICE_CANDLES = DEFAULT_BACKFILL_TARGET_CANDLES;

export function getLookbackDaysForCandles(targetCandles: number): number {
  if (targetCandles >= 600) {
    return 900;
  }

  if (targetCandles >= 365) {
    return 550;
  }

  if (targetCandles >= 200) {
    return 365;
  }

  return Math.max(365, Math.ceil(targetCandles * 1.6));
}
