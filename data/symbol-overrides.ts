import type { SymbolMetadataSourceItem } from "@/data/full-symbols-metadata";

export type SymbolMetadataOverride = Partial<Pick<SymbolMetadataSourceItem, "exchange" | "sector" | "name">> & {
  is_active?: boolean;
};

// Emergency correction layer only. Keep empty by default so provider/imported
// metadata remains the primary source of truth.
export const SYMBOL_METADATA_OVERRIDES: Record<string, SymbolMetadataOverride> = {};
