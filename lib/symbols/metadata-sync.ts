import { FULL_SYMBOLS_METADATA, type SymbolMetadataSourceItem } from "@/data/full-symbols-metadata";
import { SYMBOL_METADATA_OVERRIDES, type SymbolMetadataOverride } from "@/data/symbol-overrides";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

type SymbolRow = Pick<
  Database["public"]["Tables"]["symbols"]["Row"],
  "symbol" | "name" | "exchange" | "sector" | "is_active"
>;
type SymbolInsert = Database["public"]["Tables"]["symbols"]["Insert"];
type SymbolUpdate = Database["public"]["Tables"]["symbols"]["Update"];

export type SymbolMetadataSyncResult = {
  selected: number;
  inserted: number;
  updated: number;
  unchanged: number;
  overrideAppliedCount: number;
  overriddenSymbols: string[];
};

export type SymbolMetadataProvider = {
  name: string;
  getSymbols(): Promise<SymbolMetadataSourceItem[]>;
};

const staticMetadataProvider: SymbolMetadataProvider = {
  name: "static-full-symbols-metadata",
  async getSymbols() {
    return FULL_SYMBOLS_METADATA;
  },
};

export async function syncSymbolMetadata(
  provider: SymbolMetadataProvider = staticMetadataProvider,
): Promise<SymbolMetadataSyncResult> {
  const supabase = createSupabaseAdminClient();
  const overrideResult = applySymbolMetadataOverrides(await provider.getSymbols());
  const sourceItems = dedupeSymbols(overrideResult.items);
  const existingRows = await readExistingSymbols();
  const existingBySymbol = new Map(existingRows.map((row) => [row.symbol, row]));
  const now = new Date().toISOString();

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
      continue;
    }

    const update = toMetadataUpdate(existing, item, now);

    if (!update) {
      unchanged += 1;
      continue;
    }

    const { error } = await supabase.from("symbols").update(update).eq("symbol", item.symbol);

    if (error) {
      throw error;
    }

    updated += 1;
  }

  return {
    selected: sourceItems.length,
    inserted,
    updated,
    unchanged,
    overrideAppliedCount: overrideResult.overriddenSymbols.length,
    overriddenSymbols: overrideResult.overriddenSymbols,
  };
}

function applySymbolMetadataOverrides(items: SymbolMetadataSourceItem[]): {
  items: SymbolMetadataSourceItem[];
  overriddenSymbols: string[];
} {
  const overriddenSymbols: string[] = [];

  const nextItems = items.map((item) => {
    const symbol = item.symbol.toUpperCase();
    const override = SYMBOL_METADATA_OVERRIDES[symbol];

    if (!override) {
      return item;
    }

    overriddenSymbols.push(symbol);
    return applySymbolMetadataOverride({ ...item, symbol }, override);
  });

  return {
    items: nextItems,
    overriddenSymbols: [...new Set(overriddenSymbols)].sort((a, b) => a.localeCompare(b)),
  };
}

function applySymbolMetadataOverride(
  item: SymbolMetadataSourceItem,
  override: SymbolMetadataOverride,
): SymbolMetadataSourceItem {
  return {
    ...item,
    ...(override.name !== undefined ? { name: override.name } : {}),
    ...(override.exchange !== undefined ? { exchange: override.exchange } : {}),
    ...(override.sector !== undefined ? { sector: override.sector } : {}),
    ...(override.is_active !== undefined ? { isActive: override.is_active } : {}),
  };
}

async function readExistingSymbols(): Promise<SymbolRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("symbols")
    .select("symbol,name,exchange,sector,is_active")
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
): SymbolUpdate | null {
  const isActive = item.isActive ?? true;
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

function dedupeSymbols(items: SymbolMetadataSourceItem[]): SymbolMetadataSourceItem[] {
  const unique = new Map<string, SymbolMetadataSourceItem>();

  for (const item of items) {
    unique.set(item.symbol.toUpperCase(), {
      ...item,
      symbol: item.symbol.toUpperCase(),
      isActive: item.isActive ?? true,
    });
  }

  return [...unique.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
}
