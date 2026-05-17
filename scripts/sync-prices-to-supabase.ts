import { pathToFileURL } from "node:url";
import { loadEnvConfig } from "@next/env";
import { STOCKS } from "../data/symbols";
import { vnstockProvider } from "../lib/data-source/vnstock-provider";
import { createSupabaseAdminClient } from "../lib/supabase/admin";
import type { Database } from "../lib/supabase/types";
import { fetchPricesToLocalJson } from "./fetch-prices";
import { importJsonToSupabase, upsertPriceSetsToSupabase } from "./import-json-to-supabase";

const CANDLE_LIMIT = 200;
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
  selected: number;
  synced: number;
  failed: number;
  selectedSymbols: string[];
  failedSymbols: string[];
};

export type SyncSymbolResult = {
  symbol: string;
  refreshed: boolean;
  prices: number;
};

type SyncSingleSymbolOptions = {
  skipIfFetchedOlderThanExisting?: boolean;
};

export async function syncPricesToSupabase(options: { batch?: number; limit?: number } = {}): Promise<SyncPricesResult> {
  loadEnvConfig(process.cwd());

  const batch = options.batch ?? DEFAULT_SYNC_BATCH;
  const limit = options.limit ?? DEFAULT_SYNC_LIMIT;
  const targets = await getSyncTargets({ batch, limit });
  const symbols = targets.map((target) => target.symbol);

  console.log(`Sync target: batch ${batch}, limit ${limit}, ${symbols.length} ma (${targets[0]?.source ?? "supabase"}).`);

  if (isVercelProduction()) {
    return syncPricesDirectlyToSupabase(targets, { batch, limit });
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
    selected: targets.length,
    synced: importedSymbols,
    failed: Math.max(0, targets.length - importedSymbols),
    selectedSymbols: symbols,
    failedSymbols: importedSymbols === targets.length ? [] : symbols,
  };
}

async function syncPricesDirectlyToSupabase(
  targets: SyncTarget[],
  options: { batch: number; limit: number },
): Promise<SyncPricesResult> {
  console.log("Vercel production detected: sync truc tiep vao Supabase, khong ghi local JSON.");

  let synced = 0;
  let failed = 0;
  const failedSymbols: string[] = [];

  for (const target of targets) {
    try {
      const prices = await vnstockProvider.getDailyPrices(target.symbol, CANDLE_LIMIT);
      await upsertPriceSetsToSupabase([{ symbol: target.symbol, prices }], { upsertSymbols: false });
      await updateSymbolSyncStatus(target.symbol, "synced");
      synced += 1;
      console.log(`${target.symbol}: da fetch va upsert ${prices.length} nen tu ${vnstockProvider.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await updateSymbolSyncStatus(target.symbol, "failed", message);
      failed += 1;
      failedSymbols.push(target.symbol);
      console.error(`${target.symbol}: sync fail, bo qua ma nay (${message})`);
    }
  }

  console.log(`Sync production hoan tat. Chon ${targets.length} ma, thanh cong ${synced}, fail ${failed}.`);

  return {
    batch: options.batch,
    limit: options.limit,
    selected: targets.length,
    synced,
    failed,
    selectedSymbols: targets.map((target) => target.symbol),
    failedSymbols,
  };
}

export async function syncSingleSymbolToSupabase(
  symbol: string,
  options: SyncSingleSymbolOptions = {},
): Promise<SyncSymbolResult> {
  loadEnvConfig(process.cwd());

  const normalizedSymbol = symbol.toUpperCase();

  try {
    const prices = await vnstockProvider.getDailyPrices(normalizedSymbol, CANDLE_LIMIT);
    const latestFetchedDate = prices[prices.length - 1]?.date ?? null;
    const latestExistingDate = options.skipIfFetchedOlderThanExisting
      ? await readLatestExistingPriceDate(normalizedSymbol)
      : null;

    if (latestExistingDate && latestFetchedDate && latestFetchedDate < latestExistingDate) {
      console.warn(
        `${normalizedSymbol}: bo qua backfill vi provider tra ve du lieu cu hon DB (${latestFetchedDate} < ${latestExistingDate})`,
      );

      return {
        symbol: normalizedSymbol,
        refreshed: false,
        prices: 0,
      };
    }

    await upsertPriceSetsToSupabase([{ symbol: normalizedSymbol, prices }], { upsertSymbols: false });
    await updateSymbolSyncStatus(normalizedSymbol, "synced");

    return {
      symbol: normalizedSymbol,
      refreshed: true,
      prices: prices.length,
    };
  } catch (error) {
    await updateSymbolSyncStatus(
      normalizedSymbol,
      "failed",
      error instanceof Error ? error.message : String(error),
    );
    throw error;
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

async function hasAutoSyncSymbols(): Promise<boolean> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("symbols")
      .select("symbol")
      .eq("auto_sync", true)
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
