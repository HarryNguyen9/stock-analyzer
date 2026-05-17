import type { SymbolMetadataSourceItem } from "@/data/full-symbols-metadata";
import { SYMBOL_METADATA_OVERRIDES, type SymbolMetadataOverride } from "@/data/symbol-overrides";

export type FinalSymbolMetadataResult = {
  items: SymbolMetadataSourceItem[];
  overriddenSymbols: string[];
};

export function getFinalSymbolMetadata(items: SymbolMetadataSourceItem[]): FinalSymbolMetadataResult {
  const normalizedItems = dedupeAndNormalizeSymbols(items);
  const overriddenSymbols: string[] = [];

  const finalItems = normalizedItems.map((item) => {
    const override = getSymbolOverride(item.symbol);

    if (!override) {
      return item;
    }

    overriddenSymbols.push(item.symbol);
    return applySymbolMetadataOverride(item, override);
  });

  return {
    items: finalItems,
    overriddenSymbols: overriddenSymbols.sort((a, b) => a.localeCompare(b)),
  };
}

export function buildFinalSymbolMetadataMap(items: SymbolMetadataSourceItem[]): Map<string, SymbolMetadataSourceItem> {
  return new Map(getFinalSymbolMetadata(items).items.map((item) => [item.symbol, item]));
}

function dedupeAndNormalizeSymbols(items: SymbolMetadataSourceItem[]): SymbolMetadataSourceItem[] {
  const unique = new Map<string, SymbolMetadataSourceItem>();

  for (const item of items) {
    const symbol = item.symbol.toUpperCase();
    unique.set(symbol, {
      ...item,
      symbol,
      name: item.name.trim(),
      exchange: item.exchange,
      sector: item.sector.trim(),
      isActive: item.isActive ?? true,
    });
  }

  return [...unique.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
}

function getSymbolOverride(symbol: string): SymbolMetadataOverride | null {
  return SYMBOL_METADATA_OVERRIDES[symbol.toUpperCase()] ?? null;
}

function applySymbolMetadataOverride(
  item: SymbolMetadataSourceItem,
  override: SymbolMetadataOverride,
): SymbolMetadataSourceItem {
  return {
    ...item,
    ...(override.name !== undefined ? { name: override.name.trim() } : {}),
    ...(override.exchange !== undefined ? { exchange: override.exchange } : {}),
    ...(override.sector !== undefined ? { sector: override.sector.trim() } : {}),
    ...(override.is_active !== undefined ? { isActive: override.is_active } : {}),
  };
}
