export {
  HOME_SCANNER_SNAPSHOT_TYPE,
  readHomeScannerSnapshot,
  refreshHomeScannerSnapshot,
} from "@/lib/scanner/snapshot";
export {
  SECTOR_HEATMAP_SNAPSHOT_TYPE,
  buildSectorSummaries,
  readSectorHeatmapSnapshot,
  refreshSectorHeatmapSnapshot,
  type SectorSummary,
  type SectorTopSymbol,
} from "@/lib/sector/heatmap";
export {
  MARKET_BREADTH_SNAPSHOT_TYPE,
  buildMarketBreadth,
  readMarketBreadthSnapshot,
  refreshMarketBreadthSnapshot,
  type MarketBreadthSnapshot,
} from "@/lib/market/breadth";

export const SNAPSHOT_PIPELINE = {
  pipeline: "generate-snapshot",
  responsibility: "Read Supabase data and update market_snapshots only.",
  source: "supabase",
} as const;
