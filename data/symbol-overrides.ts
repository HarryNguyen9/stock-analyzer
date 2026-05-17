import type { SymbolMetadataSourceItem } from "@/data/full-symbols-metadata";

export type SymbolMetadataOverride = Partial<Pick<SymbolMetadataSourceItem, "exchange" | "sector" | "name">> & {
  is_active?: boolean;
};

export const SYMBOL_METADATA_OVERRIDES: Record<string, SymbolMetadataOverride> = {
  BSR: {
    exchange: "HOSE",
  },
};
