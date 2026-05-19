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

export const SNAPSHOT_PIPELINE = {
  pipeline: "generate-snapshot",
  responsibility: "Read Supabase data and update market_snapshots only.",
  source: "supabase",
} as const;
