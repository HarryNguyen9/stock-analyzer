export {
  markSymbolUnsupported,
  readExistingPriceRowCount,
  syncPricesToSupabase,
  syncSingleSymbolToSupabase,
  updateSymbolSyncStatus,
  type SyncFailedSymbol,
  type SyncPricesResult,
  type SyncSymbolResult,
} from "@/scripts/sync-prices-to-supabase";

export const PRICE_SYNC_PIPELINE = {
  pipeline: "price-sync",
  responsibility: "Update prices, technical indicators, score and sync status only.",
  source: "vnstock-provider-or-local-dev-fallback",
} as const;

export const BACKFILL_PRICE_PIPELINE = {
  pipeline: "backfill-missing-prices",
  responsibility: "Backfill missing historical prices only; no metadata or snapshot writes.",
  source: "vnstock-provider",
} as const;
