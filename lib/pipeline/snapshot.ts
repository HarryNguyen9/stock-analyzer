export {
  HOME_SCANNER_SNAPSHOT_TYPE,
  readHomeScannerSnapshot,
  refreshHomeScannerSnapshot,
} from "@/lib/scanner/snapshot";

export const SNAPSHOT_PIPELINE = {
  pipeline: "generate-snapshot",
  responsibility: "Read Supabase data and update market_snapshots only.",
  source: "supabase",
} as const;
