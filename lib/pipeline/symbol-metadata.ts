import { syncSymbolMetadata as syncSymbolMetadataService } from "@/lib/symbols/metadata-sync";

export const SYMBOL_METADATA_PIPELINE = {
  pipeline: "sync-symbol-metadata",
  responsibility: "Update symbol metadata only: name, exchange, sector, is_active, metadata_updated_at.",
  source: "metadata-provider-with-overrides",
} as const;

export const syncSymbolMetadata = syncSymbolMetadataService;
