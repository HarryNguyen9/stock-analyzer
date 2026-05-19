import { loadLatestSymbolMetadata, type LoadedSymbolMetadata } from "@/lib/symbols/metadata-provider";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { getFinalSymbolMetadata } from "@/lib/symbols/metadata-normalize";
import type { SymbolMetadataSourceItem } from "@/data/full-symbols-metadata";

type SymbolRow = Pick<
  Database["public"]["Tables"]["symbols"]["Row"],
  "symbol" | "name" | "exchange" | "sector" | "is_active" | "metadata_updated_at" | "sync_status"
>;
type SymbolInsert = Database["public"]["Tables"]["symbols"]["Insert"];
type SymbolMetadataUpdate = Pick<
  Database["public"]["Tables"]["symbols"]["Update"],
  "name" | "exchange" | "sector" | "is_active" | "metadata_updated_at"
>;

export type SymbolMetadataSyncResult = {
  selected: number;
  inserted: number;
  updated: number;
  unchanged: number;
  overrideAppliedCount: number;
  overriddenSymbols: string[];
  source: LoadedSymbolMetadata["source"];
  providerName: string;
  fetchedCount: number;
  fallbackUsed: boolean;
  staticFallbackUsed: boolean;
  sampleChangedSymbols: string[];
};

export type SymbolMetadataProvider = {
  name: string;
  getSymbols(): Promise<SymbolMetadataSourceItem[]>;
};

export async function syncSymbolMetadata(
  provider?: SymbolMetadataProvider,
): Promise<SymbolMetadataSyncResult> {
  const supabase = createSupabaseAdminClient();
  const loaded = provider
    ? {
        providerName: provider.name,
        source: "provider" as const,
        items: await provider.getSymbols(),
        fallbackUsed: false,
        staticFallbackUsed: false,
      }
    : await loadLatestSymbolMetadata();
  const metadata = getFinalSymbolMetadata(loaded.items);
  const sourceItems = metadata.items;
  const existingRows = await readExistingSymbols();
  const existingBySymbol = new Map(existingRows.map((row) => [row.symbol, row]));
  const now = new Date().toISOString();
  const sampleChangedSymbols: string[] = [];

  let inserted = 0;
  let updated = 0;
  let unchanged = 0;

  for (const item of sourceItems) {
    const existing = existingBySymbol.get(item.symbol);

    if (!existing) {
      const insert: SymbolInsert = {
        symbol: item.symbol,
        name: item.name,
        exchange: item.exchange,
        sector: item.sector,
        tier: "C",
        auto_sync: false,
        is_active: item.isActive ?? true,
        metadata_updated_at: now,
      };
      const { error } = await supabase.from("symbols").insert(insert);

      if (error) {
        throw error;
      }

      inserted += 1;
      pushSample(sampleChangedSymbols, item.symbol);
      continue;
    }

    const update = toMetadataUpdate(existing, item, now, loaded.staticFallbackUsed);

    if (!update) {
      unchanged += 1;
      continue;
    }

    const { error } = await supabase.from("symbols").update(update).eq("symbol", item.symbol);

    if (error) {
      throw error;
    }

    updated += 1;
    pushSample(sampleChangedSymbols, item.symbol);
  }

  return {
    selected: sourceItems.length,
    inserted,
    updated,
    unchanged,
    overrideAppliedCount: metadata.overriddenSymbols.length,
    overriddenSymbols: metadata.overriddenSymbols,
    source: loaded.source,
    providerName: loaded.providerName,
    fetchedCount: loaded.items.length,
    fallbackUsed: loaded.fallbackUsed,
    staticFallbackUsed: loaded.staticFallbackUsed,
    sampleChangedSymbols,
  };
}

async function readExistingSymbols(): Promise<SymbolRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("symbols")
    .select("symbol,name,exchange,sector,is_active,metadata_updated_at,sync_status")
    .order("symbol", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as SymbolRow[]).map((row) => ({
    ...row,
    symbol: row.symbol.toUpperCase(),
  }));
}

function toMetadataUpdate(
  existing: SymbolRow,
  item: SymbolMetadataSourceItem,
  metadataUpdatedAt: string,
  staticFallbackUsed: boolean,
): SymbolMetadataUpdate | null {
  if (staticFallbackUsed && existing.metadata_updated_at) {
    return null;
  }

  const isActive = existing.sync_status === "unsupported" ? false : item.isActive ?? true;
  // Metadata sync owns only identity fields. It intentionally does not touch
  // tier/auto_sync/liquidity_rank or price-related status for existing symbols.
  const update: SymbolMetadataUpdate = {};

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

function pushSample(samples: string[], symbol: string) {
  if (samples.length < 20) {
    samples.push(symbol);
  }
}
