import { pathToFileURL } from "node:url";
import { loadEnvConfig } from "@next/env";
import { createSupabaseAdminClient } from "../lib/supabase/admin";
import { loadLatestSymbolMetadata } from "../lib/symbols/metadata-provider";
import { getFinalSymbolMetadata } from "../lib/symbols/metadata-normalize";
import type { SymbolMetadataSourceItem } from "../data/full-symbols-metadata";
import type { Database } from "../lib/supabase/types";

type SymbolInsert = Database["public"]["Tables"]["symbols"]["Insert"];
type SymbolUpdate = Database["public"]["Tables"]["symbols"]["Update"];
type ExistingSymbolRow = Pick<
  Database["public"]["Tables"]["symbols"]["Row"],
  "symbol" | "name" | "exchange" | "sector" | "is_active" | "sync_status" | "metadata_updated_at"
>;

const INSERT_BATCH_SIZE = 500;

export async function importFullMarketSymbols(): Promise<{
  total: number;
  inserted: number;
  updated: number;
  unchanged: number;
  overrideAppliedCount: number;
  overriddenSymbols: string[];
  source: string;
  providerName: string;
  fetchedCount: number;
  fallbackUsed: boolean;
  staticFallbackUsed: boolean;
}> {
  loadEnvConfig(process.cwd());

  const supabase = createSupabaseAdminClient();
  const loaded = await loadLatestSymbolMetadata();
  const metadata = getFinalSymbolMetadata(loaded.items);
  const existingRows = await readExistingSymbols();
  const existingBySymbol = new Map(existingRows.map((row) => [row.symbol, row]));
  const now = new Date().toISOString();
  const inserts: SymbolInsert[] = [];
  const updates: Array<{ symbol: string; update: SymbolUpdate }> = [];
  let unchanged = 0;

  for (const item of metadata.items) {
    const existing = existingBySymbol.get(item.symbol);
    const isActive = existing?.sync_status === "unsupported" ? false : item.isActive ?? true;

    if (!existing) {
      inserts.push({
        symbol: item.symbol,
        name: item.name,
        exchange: item.exchange,
        sector: item.sector,
        tier: "C",
        auto_sync: false,
        liquidity_rank: null,
        sync_status: "metadata_only",
        is_active: isActive,
        metadata_updated_at: now,
      });
      continue;
    }

    const update = toMetadataUpdate(existing, item, isActive, now, loaded.staticFallbackUsed);

    if (!update) {
      unchanged += 1;
      continue;
    }

    updates.push({ symbol: item.symbol, update });
  }

  for (let index = 0; index < inserts.length; index += INSERT_BATCH_SIZE) {
    const batch = inserts.slice(index, index + INSERT_BATCH_SIZE);
    const { error } = await supabase.from("symbols").insert(batch);

    if (error) {
      throw error;
    }
  }

  for (const item of updates) {
    const { error } = await supabase.from("symbols").update(item.update).eq("symbol", item.symbol);

    if (error) {
      throw error;
    }
  }

  return {
    total: metadata.items.length,
    inserted: inserts.length,
    updated: updates.length,
    unchanged,
    overrideAppliedCount: metadata.overriddenSymbols.length,
    overriddenSymbols: metadata.overriddenSymbols,
    source: loaded.source,
    providerName: loaded.providerName,
    fetchedCount: loaded.items.length,
    fallbackUsed: loaded.fallbackUsed,
    staticFallbackUsed: loaded.staticFallbackUsed,
  };
}

async function readExistingSymbols(): Promise<ExistingSymbolRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("symbols")
    .select("symbol,name,exchange,sector,is_active,sync_status,metadata_updated_at")
    .order("symbol", { ascending: true })
    .limit(3000);

  if (error) {
    throw error;
  }

  return ((data ?? []) as ExistingSymbolRow[]).map((row) => ({
    ...row,
    symbol: row.symbol.toUpperCase(),
  }));
}

function toMetadataUpdate(
  existing: ExistingSymbolRow,
  item: SymbolMetadataSourceItem,
  isActive: boolean,
  metadataUpdatedAt: string,
  staticFallbackUsed: boolean,
): SymbolUpdate | null {
  if (staticFallbackUsed && existing.metadata_updated_at) {
    return null;
  }

  const update: SymbolUpdate = {};

  if (existing.name !== item.name) update.name = item.name;
  if (existing.exchange !== item.exchange) update.exchange = item.exchange;
  if (existing.sector !== item.sector) update.sector = item.sector;
  if (existing.is_active !== isActive) update.is_active = isActive;

  if (Object.keys(update).length === 0) {
    return null;
  }

  update.metadata_updated_at = metadataUpdatedAt;
  return update;
}

function isDirectRun(importMetaUrl: string): boolean {
  return Boolean(process.argv[1] && importMetaUrl === pathToFileURL(process.argv[1]).href);
}

if (isDirectRun(import.meta.url)) {
  importFullMarketSymbols()
    .then((result) => {
      console.log("Import full market symbols done");
      console.log(`total: ${result.total}`);
      console.log(`inserted: ${result.inserted}`);
      console.log(`updated: ${result.updated}`);
      console.log(`unchanged: ${result.unchanged}`);
      console.log(`overrideAppliedCount: ${result.overrideAppliedCount}`);
      console.log(`overriddenSymbols: ${result.overriddenSymbols.join(", ") || "(none)"}`);
      console.log(`source: ${result.source}`);
      console.log(`providerName: ${result.providerName}`);
      console.log(`fetchedCount: ${result.fetchedCount}`);
      console.log(`fallbackUsed: ${result.fallbackUsed}`);
      console.log(`staticFallbackUsed: ${result.staticFallbackUsed}`);
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}
