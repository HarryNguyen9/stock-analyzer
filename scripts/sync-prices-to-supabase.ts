import { pathToFileURL } from "node:url";
import { loadEnvConfig } from "@next/env";
import { STOCKS } from "../data/symbols";
import { classifyProviderFailure } from "../lib/data-source/provider-errors";
import {
  DEFAULT_HISTORICAL_CANDLE_LIMIT,
  DEFAULT_RECENT_SYNC_CANDLE_LIMIT,
  TARGET_STOCK_PRICE_CANDLES,
} from "../lib/data-source/constants";
import { vnstockProvider } from "../lib/data-source/vnstock-provider";
import { createSupabaseAdminClient } from "../lib/supabase/admin";
import type { Database } from "../lib/supabase/types";
import { fetchPricesToLocalJson } from "./fetch-prices";
import { importJsonToSupabase, upsertPriceSetsToSupabase } from "./import-json-to-supabase";

const DEFAULT_SYNC_BATCH = 0;
const DEFAULT_SYNC_LIMIT = 100;

type SymbolRow = Pick<
  Database["public"]["Tables"]["symbols"]["Row"],
  "symbol" | "tier" | "auto_sync" | "liquidity_rank"
>;
type SymbolRetryRow = Pick<Database["public"]["Tables"]["symbols"]["Row"], "retry_count">;

type SyncTarget = {
  symbol: string;
  tier: SymbolRow["tier"];
  autoSync: boolean;
  liquidityRank: number | null;
  source: "supabase" | "fallback";
};

export type SyncPricesResult = {
  batch: number;
  limit: number;
  candleLimit: number;
  targetCandles: number;
  selected: number;
  synced: number;
  failed: number;
  failedTemporary: SyncFailedSymbol[];
  failedUnsupported: SyncFailedSymbol[];
  selectedSymbols: string[];
  failedSymbols: string[];
  stoppedEarly: boolean;
  stopReason: "time_guard" | null;
};

export type SyncSymbolResult = {
  symbol: string;
  refreshed: boolean;
  prices: number;
  candleLimit: number;
  existingRows: number;
  fetchedCandles: number;
  upsertedCandles: number;
  targetCandles: number;
};

type SyncSingleSymbolOptions = {
  skipIfFetchedOlderThanExisting?: boolean;
  candleLimit?: number;
};

export type SyncFailedSymbol = {
  symbol: string;
  error: string;
};

export async function syncPricesToSupabase(
  options: { batch?: number; limit?: number; shouldStop?: () => boolean } = {},
): Promise<SyncPricesResult> {
  loadEnvConfig(process.cwd());

  const batch = options.batch ?? DEFAULT_SYNC_BATCH;
  const limit = options.limit ?? DEFAULT_SYNC_LIMIT;
  const targets = await getSyncTargets({ batch, limit });
  const symbols = targets.map((target) => target.symbol);

  console.log(`Sync target: batch ${batch}, limit ${limit}, ${symbols.length} ma (${targets[0]?.source ?? "supabase"}).`);

  if (isVercelProduction()) {
    return syncPricesDirectlyToSupabase(targets, { batch, limit, shouldStop: options.shouldStop });
  }

  console.log("Sync buoc 1/2: fetch du lieu moi va cap nhat JSON local...");
  await fetchPricesToLocalJson(symbols);

  console.log("Sync buoc 2/2: upsert du lieu JSON vao Supabase...");
  const { importedSymbols } = await importJsonToSupabase(symbols);

  await Promise.all(symbols.map((symbol) => updateSymbolSyncStatus(symbol, "synced")));

  console.log(`Sync hoan tat. Da cap nhat ${importedSymbols} ma.`);
  return {
    batch,
    limit,
    candleLimit: DEFAULT_HISTORICAL_CANDLE_LIMIT,
    targetCandles: TARGET_STOCK_PRICE_CANDLES,
    selected: targets.length,
    synced: importedSymbols,
    failed: Math.max(0, targets.length - importedSymbols),
    failedTemporary: importedSymbols === targets.length ? [] : symbols.map((symbol) => ({ symbol, error: "Local import failed." })),
    failedUnsupported: [],
    selectedSymbols: symbols,
    failedSymbols: importedSymbols === targets.length ? [] : symbols,
    stoppedEarly: false,
    stopReason: null,
  };
}

async function syncPricesDirectlyToSupabase(
  targets: SyncTarget[],
  options: { batch: number; limit: number; shouldStop?: () => boolean },
): Promise<SyncPricesResult> {
  console.log("Vercel production detected: sync truc tiep vao Supabase, khong ghi local JSON.");

  let synced = 0;
  let failed = 0;
  let stoppedEarly = false;
  const failedSymbols: string[] = [];
  const failedTemporary: SyncFailedSymbol[] = [];
  const failedUnsupported: SyncFailedSymbol[] = [];

  for (const target of targets) {
    if (options.shouldStop?.()) {
      stoppedEarly = true;
      console.warn("Dung sync som do time guard truoc khi xu ly them symbol.");
      break;
    }

    try {
      const prices = await vnstockProvider.getDailyPrices(target.symbol, DEFAULT_RECENT_SYNC_CANDLE_LIMIT);
      await upsertPriceSetsToSupabase([{ symbol: target.symbol, prices }], { upsertSymbols: false });
      await updateSymbolSyncStatus(target.symbol, "synced");
      synced += 1;
      console.log(`${target.symbol}: da fetch va upsert ${prices.length} nen tu ${vnstockProvider.name}`);
    } catch (error) {
      const failure = classifyProviderFailure(error);

      if (failure.kind === "unsupported") {
        await markSymbolUnsupported(target.symbol, failure.message);
        failedUnsupported.push({ symbol: target.symbol, error: failure.message });
      } else {
        await updateSymbolSyncStatus(target.symbol, "failed", failure.message);
        failedTemporary.push({ symbol: target.symbol, error: failure.message });
      }

      failed += 1;
      failedSymbols.push(target.symbol);
      console.error(`${target.symbol}: sync fail, bo qua ma nay (${failure.message})`);
    }
  }

  console.log(`Sync production hoan tat. Chon ${targets.length} ma, thanh cong ${synced}, fail ${failed}.`);

  return {
    batch: options.batch,
    limit: options.limit,
    candleLimit: DEFAULT_RECENT_SYNC_CANDLE_LIMIT,
    targetCandles: TARGET_STOCK_PRICE_CANDLES,
    selected: targets.length,
    synced,
    failed,
    failedTemporary,
    failedUnsupported,
    selectedSymbols: targets.map((target) => target.symbol),
    failedSymbols,
    stoppedEarly,
    stopReason: stoppedEarly ? "time_guard" : null,
  };
}

export async function syncSingleSymbolToSupabase(
  symbol: string,
  options: SyncSingleSymbolOptions = {},
): Promise<SyncSymbolResult> {
  loadEnvConfig(process.cwd());

  const normalizedSymbol = symbol.toUpperCase();
  const candleLimit = options.candleLimit ?? DEFAULT_RECENT_SYNC_CANDLE_LIMIT;
  const existingRows = await readExistingPriceRowCount(normalizedSymbol);

  try {
    const prices = await vnstockProvider.getDailyPrices(normalizedSymbol, candleLimit);
    const latestFetchedDate = prices[prices.length - 1]?.date ?? null;
    const latestExistingDate = options.skipIfFetchedOlderThanExisting
      ? await readLatestExistingPriceDate(normalizedSymbol)
      : null;

    if (latestExistingDate && latestFetchedDate && latestFetchedDate < latestExistingDate && existingRows >= TARGET_STOCK_PRICE_CANDLES) {
      console.warn(
        `${normalizedSymbol}: bo qua backfill vi provider tra ve du lieu cu hon DB (${latestFetchedDate} < ${latestExistingDate})`,
      );

      return {
        symbol: normalizedSymbol,
        refreshed: false,
        prices: 0,
        candleLimit,
        existingRows,
        fetchedCandles: prices.length,
        upsertedCandles: 0,
        targetCandles: TARGET_STOCK_PRICE_CANDLES,
      };
    }

    await upsertPriceSetsToSupabase([{ symbol: normalizedSymbol, prices }], { upsertSymbols: false });
    await updateSymbolSyncStatus(normalizedSymbol, "synced");

    return {
      symbol: normalizedSymbol,
      refreshed: true,
      prices: prices.length,
      candleLimit,
      existingRows,
      fetchedCandles: prices.length,
      upsertedCandles: prices.length,
      targetCandles: TARGET_STOCK_PRICE_CANDLES,
    };
  } catch (error) {
    const failure = classifyProviderFailure(error);

    if (failure.kind === "unsupported") {
      await markSymbolUnsupported(normalizedSymbol, failure.message);
    } else {
      await updateSymbolSyncStatus(normalizedSymbol, "failed", failure.message);
    }

    throw error;
  }
}

export async function readExistingPriceRowCount(symbol: string): Promise<number> {
  try {
    const supabase = createSupabaseAdminClient();
    const { count, error } = await supabase
      .from("stock_prices")
      .select("date", { count: "exact", head: true })
      .eq("symbol", symbol.toUpperCase());

    if (error) {
      return 0;
    }

    return count ?? 0;
  } catch {
    return 0;
  }
}

async function readLatestExistingPriceDate(symbol: string): Promise<string | null> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("stock_prices")
      .select("date")
      .eq("symbol", symbol)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return typeof data.date === "string" ? data.date : null;
  } catch {
    return null;
  }
}

async function getSyncTargets(options: { batch: number; limit: number }): Promise<SyncTarget[]> {
  const from = options.batch * options.limit;
  const to = from + options.limit - 1;

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("symbols")
      .select("symbol,tier,auto_sync,liquidity_rank")
      .eq("auto_sync", true)
      .eq("is_active", true)
      .or("sync_status.is.null,sync_status.neq.unsupported")
      .order("liquidity_rank", { ascending: true, nullsFirst: false })
      .order("symbol", { ascending: true })
      .range(from, to);

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as SymbolRow[];

    if (rows.length > 0) {
      console.log(`Supabase selected ${rows.length} symbols auto_sync=true.`);
      return rows.map((row) => ({
        symbol: row.symbol.toUpperCase(),
        tier: row.tier,
        autoSync: row.auto_sync,
        liquidityRank: row.liquidity_rank,
        source: "supabase",
      }));
    }

    const hasAnyAutoSync = await hasAutoSyncSymbols();

    if (hasAnyAutoSync) {
      console.log(`Supabase batch ${options.batch} khong co symbol nao trong range hien tai.`);
      return [];
    }

    console.log("Supabase chua co symbols auto_sync=true, fallback ve danh sach mac dinh.");
    return getFallbackTargets(options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Khong doc duoc symbols auto_sync tu Supabase (${message}), fallback ve danh sach mac dinh.`);
    return getFallbackTargets(options);
  }
}

export async function markSymbolUnsupported(symbol: string, reason: string) {
  try {
    const supabase = createSupabaseAdminClient();
    // Price sync is not allowed to overwrite metadata or universe ownership fields.
    // Keep auto_sync/is_active unchanged; selection excludes sync_status='unsupported'.
    const update: Pick<
      Database["public"]["Tables"]["symbols"]["Update"],
      "sync_status" | "last_error" | "retry_count" | "next_retry_at" | "unsupported_at" | "unsupported_reason"
    > = {
      sync_status: "unsupported",
      last_error: reason,
      retry_count: 0,
      next_retry_at: null,
      unsupported_at: new Date().toISOString(),
      unsupported_reason: reason,
    };
    const { error } = await supabase.from("symbols").update(update).eq("symbol", symbol);

    if (error) {
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`${symbol}: khong cap nhat duoc unsupported (${message})`);
  }
}

async function hasAutoSyncSymbols(): Promise<boolean> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("symbols")
      .select("symbol")
      .eq("auto_sync", true)
      .eq("is_active", true)
      .or("sync_status.is.null,sync_status.neq.unsupported")
      .limit(1);

    if (error) {
      throw error;
    }

    return Boolean(data && data.length > 0);
  } catch {
    return false;
  }
}

function getFallbackTargets(options: { batch: number; limit: number }): SyncTarget[] {
  if (isVercelProduction()) {
    console.warn("Production fallback static symbols is being used because Supabase auto_sync symbols are unavailable.");
  }

  const from = options.batch * options.limit;
  const to = from + options.limit;

  return STOCKS.slice(from, to).map((stock, index) => ({
    symbol: stock.symbol,
    tier: "A",
    autoSync: true,
    liquidityRank: from + index + 1,
    source: "fallback",
  }));
}

export async function updateSymbolSyncStatus(
  symbol: string,
  status: "synced" | "failed",
  errorMessage: string | null = null,
) {
  try {
    const supabase = createSupabaseAdminClient();
    const retryCount = status === "failed" ? await readSymbolRetryCount(symbol) : 0;
    const nextRetryCount = retryCount + 1;
    const update: Database["public"]["Tables"]["symbols"]["Update"] = {
      sync_status: status,
      ...(status === "synced"
        ? {
            last_synced_at: new Date().toISOString(),
            retry_count: 0,
            last_error: null,
            next_retry_at: null,
          }
        : {
            retry_count: nextRetryCount,
            last_error: errorMessage,
            next_retry_at: getNextRetryAt(nextRetryCount).toISOString(),
          }),
    };

    const { error } = await supabase.from("symbols").update(update).eq("symbol", symbol);

    if (error) {
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`${symbol}: khong cap nhat duoc sync_status (${message})`);
  }
}

async function readSymbolRetryCount(symbol: string): Promise<number> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("symbols")
      .select("retry_count")
      .eq("symbol", symbol)
      .maybeSingle();

    if (error || !data) {
      return 0;
    }

    const row = data as SymbolRetryRow;
    return Number.isFinite(row.retry_count) ? row.retry_count : 0;
  } catch {
    return 0;
  }
}

function getNextRetryAt(retryCount: number): Date {
  const delayMs =
    retryCount <= 1
      ? 15 * 60 * 1000
      : retryCount === 2
        ? 60 * 60 * 1000
        : 6 * 60 * 60 * 1000;

  return new Date(Date.now() + delayMs);
}

function isVercelProduction(): boolean {
  return process.env.VERCEL === "1" && process.env.VERCEL_ENV === "production";
}

function isDirectRun(importMetaUrl: string): boolean {
  return Boolean(process.argv[1] && importMetaUrl === pathToFileURL(process.argv[1]).href);
}

if (isDirectRun(import.meta.url)) {
  syncPricesToSupabase().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
