import { pathToFileURL } from "node:url";
import { loadEnvConfig } from "@next/env";
import { STOCKS } from "../data/symbols";
import { vnstockProvider } from "../lib/data-source/vnstock-provider";
import { createSupabaseAdminClient } from "../lib/supabase/admin";
import type { Database } from "../lib/supabase/types";
import { fetchPricesToLocalJson } from "./fetch-prices";
import { importJsonToSupabase, upsertPriceSetsToSupabase } from "./import-json-to-supabase";

const CANDLE_LIMIT = 200;
const DEFAULT_SYNC_LIMIT = 300;

type SymbolRow = Pick<
  Database["public"]["Tables"]["symbols"]["Row"],
  "symbol" | "tier" | "auto_sync" | "liquidity_rank"
>;

type SyncTarget = {
  symbol: string;
  tier: SymbolRow["tier"];
  autoSync: boolean;
  liquidityRank: number | null;
  source: "supabase" | "fallback";
};

export async function syncPricesToSupabase(options: { limit?: number } = {}): Promise<{ synced: number }> {
  loadEnvConfig(process.cwd());

  const limit = options.limit ?? DEFAULT_SYNC_LIMIT;
  const targets = await getSyncTargets(limit);
  const symbols = targets.map((target) => target.symbol);

  console.log(`Sync target: ${symbols.length} ma (${targets[0]?.source ?? "supabase"}).`);

  if (isVercelProduction()) {
    return syncPricesDirectlyToSupabase(targets);
  }

  console.log("Sync buoc 1/2: fetch du lieu moi va cap nhat JSON local...");
  await fetchPricesToLocalJson(symbols);

  console.log("Sync buoc 2/2: upsert du lieu JSON vao Supabase...");
  const { importedSymbols } = await importJsonToSupabase(symbols);

  await Promise.all(symbols.map((symbol) => updateSymbolSyncStatus(symbol, "synced")));

  console.log(`Sync hoan tat. Da cap nhat ${importedSymbols} ma.`);
  return { synced: importedSymbols };
}

async function syncPricesDirectlyToSupabase(targets: SyncTarget[]): Promise<{ synced: number }> {
  console.log("Vercel production detected: sync truc tiep vao Supabase, khong ghi local JSON.");

  let synced = 0;

  for (const target of targets) {
    try {
      const prices = await vnstockProvider.getDailyPrices(target.symbol, CANDLE_LIMIT);
      await upsertPriceSetsToSupabase([{ symbol: target.symbol, prices }], { upsertSymbols: false });
      await updateSymbolSyncStatus(target.symbol, "synced");
      synced += 1;
      console.log(`${target.symbol}: da fetch va upsert ${prices.length} nen tu ${vnstockProvider.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await updateSymbolSyncStatus(target.symbol, "failed");
      console.error(`${target.symbol}: sync fail, bo qua ma nay (${message})`);
    }
  }

  console.log(`Sync production hoan tat. Da cap nhat ${synced} ma.`);

  return { synced };
}

async function getSyncTargets(limit: number): Promise<SyncTarget[]> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("symbols")
      .select("symbol,tier,auto_sync,liquidity_rank")
      .eq("auto_sync", true)
      .order("tier", { ascending: true })
      .order("liquidity_rank", { ascending: true, nullsFirst: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as SymbolRow[];

    if (rows.length > 0) {
      return rows.map((row) => ({
        symbol: row.symbol.toUpperCase(),
        tier: row.tier,
        autoSync: row.auto_sync,
        liquidityRank: row.liquidity_rank,
        source: "supabase",
      }));
    }

    console.log("Supabase chua co symbols auto_sync=true, fallback ve danh sach mac dinh.");
    return getFallbackTargets(limit);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Khong doc duoc symbols auto_sync tu Supabase (${message}), fallback ve danh sach mac dinh.`);
    return getFallbackTargets(limit);
  }
}

function getFallbackTargets(limit: number): SyncTarget[] {
  return STOCKS.slice(0, limit).map((stock, index) => ({
    symbol: stock.symbol,
    tier: "A",
    autoSync: true,
    liquidityRank: index + 1,
    source: "fallback",
  }));
}

async function updateSymbolSyncStatus(symbol: string, status: "synced" | "failed") {
  try {
    const supabase = createSupabaseAdminClient();
    const update: Database["public"]["Tables"]["symbols"]["Update"] = {
      sync_status: status,
      ...(status === "synced" ? { last_synced_at: new Date().toISOString() } : {}),
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
