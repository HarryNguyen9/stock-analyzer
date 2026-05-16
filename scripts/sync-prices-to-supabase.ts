import { pathToFileURL } from "node:url";
import { STOCKS } from "../data/symbols";
import { vnstockProvider } from "../lib/data-source/vnstock-provider";
import type { OHLCV, StockSymbol } from "../types/stock";
import { fetchPricesToLocalJson } from "./fetch-prices";
import { importJsonToSupabase, upsertPriceSetsToSupabase } from "./import-json-to-supabase";

const CANDLE_LIMIT = 200;

export async function syncPricesToSupabase(): Promise<{ synced: number }> {
  if (isVercelProduction()) {
    return syncPricesDirectlyToSupabase();
  }

  console.log("Sync buoc 1/2: fetch du lieu moi va cap nhat JSON local...");
  await fetchPricesToLocalJson();

  console.log("Sync buoc 2/2: upsert du lieu JSON vao Supabase...");
  const { importedSymbols } = await importJsonToSupabase();

  console.log(`Sync hoan tat. Da cap nhat ${importedSymbols} ma.`);
  return { synced: importedSymbols };
}

async function syncPricesDirectlyToSupabase(): Promise<{ synced: number }> {
  console.log("Vercel production detected: sync truc tiep vao Supabase, khong ghi local JSON.");

  const priceSets: Array<{ symbol: StockSymbol; prices: OHLCV[] }> = [];

  for (const stock of STOCKS) {
    try {
      const prices = await vnstockProvider.getDailyPrices(stock.symbol, CANDLE_LIMIT);
      priceSets.push({ symbol: stock.symbol, prices });
      console.log(`${stock.symbol}: da fetch ${prices.length} nen tu ${vnstockProvider.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`${stock.symbol}: fetch fail, bo qua upsert Supabase (${message})`);
    }
  }

  const { importedSymbols } = await upsertPriceSetsToSupabase(priceSets);
  console.log(`Sync production hoan tat. Da cap nhat ${importedSymbols} ma.`);

  return { synced: importedSymbols };
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
